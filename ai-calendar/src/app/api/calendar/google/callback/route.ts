import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { accountsDb } from '@/lib/db/accountsDb';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/google/callback'
);

function generateCallbackHTML(success: boolean, message: string = '') {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connecting Google Calendar...</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
          }
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .success { color: #4ade80; }
          .error { color: #f87171; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>${success ? 'Successfully Connected!' : 'Connection Failed'}</h2>
          <p>${success ? 'Your Google Calendar has been connected.' : message}</p>
          <p>Closing this window...</p>
        </div>
        <script>
          // Send message to parent window
          if (window.opener) {
            window.opener.postMessage(
              { 
                type: 'calendar-auth-complete', 
                success: ${success},
                message: '${message}'
              }, 
              window.location.origin
            );
          }
          
          // Close window after a short delay
          setTimeout(() => {
            window.close();
            // If window.close() doesn't work (some browsers block it)
            // Show a message to manually close
            if (!window.closed) {
              document.body.innerHTML = '<div class="container"><h2>You can now close this window</h2></div>';
            }
          }, 2000);
        </script>
      </body>
    </html>
  `;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This is the wallet address
  const error = searchParams.get('error');
  
  // Handle OAuth errors
  if (error) {
    return new NextResponse(
      generateCallbackHTML(false, `Authorization failed: ${error}`),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  if (!code || !state) {
    return new NextResponse(
      generateCallbackHTML(false, 'Missing required parameters'),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    
    // Calculate token expiry (typically 1 hour from now)
    const tokenExpiry = tokens.expiry_date ? 
      Math.floor(tokens.expiry_date / 1000) : 
      Math.floor(Date.now() / 1000) + 3600;
    
    // Save to SQLite database
    accountsDb.createOrUpdateAccountSync({
      wallet_address: state,
      google_email: userInfo.email || '',
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      token_expiry: tokenExpiry,
      scopes: tokens.scope
    });
    
    // Return success HTML
    return new NextResponse(
      generateCallbackHTML(true),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    return new NextResponse(
      generateCallbackHTML(false, 'Failed to connect calendar. Please try again.'),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}