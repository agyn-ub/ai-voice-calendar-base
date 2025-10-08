import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/google/callback'
);

function generateCallbackHTML(success: boolean, message: string = '') {
  // Escape message for safe inclusion in JavaScript
  const escapedMessage = message.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
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
          <p>${message || (success ? 'Your Google Calendar has been connected.' : 'Failed to connect calendar.')}</p>
          <p>Closing this window...</p>
        </div>
        <script>
          console.log('[OAuth Popup] Sending message to parent window...');
          
          // Try multiple methods to communicate back to parent
          try {
            // Method 1: PostMessage to opener
            if (window.opener && !window.opener.closed) {
              console.log('[OAuth Popup] Posting message to opener');
              window.opener.postMessage(
                { 
                  type: 'calendar-auth-complete', 
                  success: ${success},
                  message: '${escapedMessage}'
                }, 
                window.location.origin
              );
            } else {
              console.warn('[OAuth Popup] No opener window available');
            }
            
            // Method 2: Also try parent in case of iframe
            if (window.parent && window.parent !== window) {
              console.log('[OAuth Popup] Posting message to parent');
              window.parent.postMessage(
                { 
                  type: 'calendar-auth-complete', 
                  success: ${success},
                  message: '${escapedMessage}'
                }, 
                window.location.origin
              );
            }
          } catch (err) {
            console.error('[OAuth Popup] Error sending message:', err);
          }
          
          // Close window after a short delay
          setTimeout(() => {
            try {
              console.log('[OAuth Popup] Attempting to close window...');
              window.close();
              
              // If window.close() doesn't work (some browsers block it)
              // Show a message to manually close
              setTimeout(() => {
                if (!window.closed) {
                  console.log('[OAuth Popup] Window.close() failed, showing manual close message');
                  document.body.innerHTML = '<div class="container"><h2>You can now close this window</h2><p>The authentication ${success ? 'succeeded' : 'failed'}.</p></div>';
                }
              }, 500);
            } catch (err) {
              console.error('[OAuth Popup] Error closing window:', err);
              document.body.innerHTML = '<div class="container"><h2>You can now close this window</h2><p>The authentication ${success ? 'succeeded' : 'failed'}.</p></div>';
            }
          }, 2000);
        </script>
      </body>
    </html>
  `;
}

export async function GET(request: NextRequest) {
  console.log('[OAuth Callback] Route hit! URL:', request.url);
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This is the wallet address
  const error = searchParams.get('error');
  
  console.log('[OAuth Callback] Params received:', {
    hasCode: !!code,
    codeLength: code?.length,
    state: state,
    error: error,
    allParams: Array.from(searchParams.entries())
  });
  
  // Handle OAuth errors
  if (error) {
    console.error('[OAuth Callback] OAuth error from Google:', error);
    return new NextResponse(
      generateCallbackHTML(false, `Authorization failed: ${error}`),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  if (!code || !state) {
    console.error('[OAuth Callback] Missing required parameters - code:', !!code, 'state:', !!state);
    return new NextResponse(
      generateCallbackHTML(false, 'Missing required parameters'),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
  
  // Send immediate response with loading state, then process in background
  console.log('[OAuth Callback] Processing OAuth callback asynchronously...');
  
  try {
    console.log('[OAuth Callback] Starting token exchange for wallet:', state);
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('[OAuth Callback] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date
    });
    
    oauth2Client.setCredentials(tokens);
    
    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    console.log('[OAuth Callback] User info retrieved:', userInfo.email);
    
    // Calculate token expiry (typically 1 hour from now)
    const tokenExpiry = tokens.expiry_date ? 
      Math.floor(tokens.expiry_date / 1000) : 
      Math.floor(Date.now() / 1000) + 3600;
    
    // Save to database with detailed error handling
    try {
      console.log('[OAuth Callback] Attempting to save to database...');
      
      const account = await postgresAccountsDb.saveAccount({
        wallet_address: state,
        google_email: userInfo.email || '',
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        token_expiry: tokenExpiry,
        scopes: tokens.scope
      });
      
      if (account) {
        console.log('[OAuth Callback] Successfully saved to PostgreSQL:', account.wallet_address);
      } else {
        throw new Error('Failed to save account to database');
      }
      
    } catch (dbError) {
      console.error('[OAuth Callback] Database save failed:', dbError);
      console.error('[OAuth Callback] Error details:', {
        message: dbError instanceof Error ? dbError.message : 'Unknown error',
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      
      // Still return success HTML but with a warning
      return new NextResponse(
        generateCallbackHTML(true, 'Connected but had issues saving. Please refresh and try again.'),
        { 
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // Return success HTML
    return new NextResponse(
      generateCallbackHTML(true),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    console.error('[OAuth Callback] Fatal error:', error);
    console.error('[OAuth Callback] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: searchParams.get('code') ? 'Code was present' : 'No code received',
      state: state || 'No state',
      errorParam: searchParams.get('error')
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect calendar. Please try again.';
    return new NextResponse(
      generateCallbackHTML(false, errorMessage),
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}