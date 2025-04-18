import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
// Removed VNPay import as it's incompatible with Deno
// import { VNPay } from 'https://esm.sh/vnpay@2.2.0';

// Helper function to format date according to VNPay requirements (yyyyMMddHHmmss)
function formatVnpayDate(date: Date): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Create our own hmacSha512 function using Deno.crypto
async function hmacSha512(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  
  // Create signature
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Custom implementation to create VNPay payment URL
async function buildVNPayUrl(params: Record<string, string | number>, secureSecret: string): Promise<string> {
  // Sort params by key
  const sortedKeys = Object.keys(params).sort();
  const sortedParams: Record<string, string | number> = {};
  
  for (const key of sortedKeys) {
    if (params[key] !== "" && params[key] !== null && params[key] !== undefined) {
      sortedParams[key] = params[key];
    }
  }
  
  // Build query string
  const queryString = new URLSearchParams();
  for (const [key, value] of Object.entries(sortedParams)) {
    queryString.append(key, value.toString());
  }
  
  // Create the base string for signing
  const signData = queryString.toString();
  
  // Create the HMAC signature
  const secureHash = await hmacSha512(secureSecret, signData);
  
  // Add hash to query params
  queryString.append('vnp_SecureHash', secureHash);
  
  // Build the final URL
  const baseUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  return `${baseUrl}?${queryString.toString()}`;
}

// Handle HTTP requests
serve(async (req) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  // For POST requests, create a VNPay payment URL
  if (req.method === 'POST') {
    try {
      // Parse the request
      const requestData = await req.json();
      const { orderId, amount, useQR } = requestData;
      
      // Validate required fields
      if (!orderId || !amount) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: orderId and amount" }),
          { status: 400, headers }
        );
      }

      // Create a transaction reference that meets VNPay's requirements
      // Must be unique and contain only alphanumeric characters
      const timestamp = Date.now();
      const transactionRef = `TX${orderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)}${timestamp}`;
      
      // Log environment variables (without sensitive values)
      console.log('Environment check:', {
        hasVnpayTmnCode: !!Deno.env.get('VNPAY_TMN_CODE'),
        hasVnpayHashSecret: !!Deno.env.get('VNPAY_HASH_SECRET'),
        hasVnpayUrl: !!Deno.env.get('VNPAY_URL'),
        hasVnpayReturnUrl: !!Deno.env.get('VNPAY_RETURN_URL'),
      });
      
      // Check if all required env vars are present
      const vnpayTmnCode = Deno.env.get('VNPAY_TMN_CODE');
      const vnpayHashSecret = Deno.env.get('VNPAY_HASH_SECRET');
      const vnpayReturnUrl = Deno.env.get('VNPAY_RETURN_URL');
      
      if (!vnpayTmnCode || !vnpayHashSecret || !vnpayReturnUrl) {
        return new Response(
          JSON.stringify({ 
            error: 'Missing VNPay configuration', 
            details: {
              hasTmnCode: !!vnpayTmnCode,
              hasHashSecret: !!vnpayHashSecret,
              hasReturnUrl: !!vnpayReturnUrl
            }
          }),
          { status: 200, headers }
        );
      }
      
      try {
        // Convert amount to VND (mandatory for VNPay)
        // VNPay requires the amount to be in VND and multiplied by 100
        // For example, 50,000 VND should be sent as 5000000
        // Minimum amount is usually 10,000 VND (1000000 after multiplication)
        let amountInVND = Math.floor(amount * 23000);
        
        // Ensure the amount is at least 10,000 VND for testing
        if (amountInVND < 10000) {
          amountInVND = 10000;
        }
        
        // Multiply by 100 as required by VNPay
        const vnpayAmount = amountInVND * 100;
        
        // Get client IP
        const clientIp = req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         '127.0.0.1';
        
        // Current date formatted according to VNPay requirements
        const createDate = formatVnpayDate(new Date());
        
        console.log('Building payment URL with params:', {
          tmnCode: vnpayTmnCode,
          amount: vnpayAmount,
          orderId,
          txnRef: transactionRef,
          ipAddr: clientIp,
          returnUrl: vnpayReturnUrl,
          createDate
        });
        
        // Create payment URL with all required parameters
        const paymentParams: Record<string, string | number> = {
          vnp_Amount: vnpayAmount,
          vnp_Command: 'pay',
          vnp_CreateDate: createDate,
          vnp_CurrCode: 'VND',
          vnp_IpAddr: clientIp,
          vnp_Locale: 'vn',
          vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
          vnp_OrderType: '250000', // Default for other services
          vnp_ReturnUrl: vnpayReturnUrl,
          vnp_TmnCode: vnpayTmnCode,
          vnp_TxnRef: transactionRef,
          vnp_Version: '2.1.0'
        };
        
        let paymentUrl = '';
        
        if (useQR) {
          // For QR payment, we need to create a specific URL format
          // Add QR-specific parameters
          const qrParams: Record<string, string | number> = {
            ...paymentParams,
            vnp_BankCode: 'VNPAYQR',
            vnp_ExpireDate: formatVnpayDate(new Date(Date.now() + 15 * 60 * 1000)) // 15 minutes expiry
          };
          
          // Build the standard URL first
          const standardUrl = await buildVNPayUrl(qrParams, vnpayHashSecret);
          
          // Extract the hash value for token generation
          const urlObj = new URL(standardUrl);
          const secureHash = urlObj.searchParams.get('vnp_SecureHash') || '';
          
          // Manually build the QR payment URL
          // For VNPay QR, we need a specific token format, which is usually provided by their API
          // As a fallback, we'll use a shortened version of the hash
          const token = secureHash.substring(0, 32);
          paymentUrl = `https://sandbox.vnpayment.vn/paymentv2/VnPayQR/Transaction/Index.html?token=${token}`;
          
          console.log('QR Payment URL created:', paymentUrl);
        } else {
          // Standard payment URL
          paymentUrl = await buildVNPayUrl(paymentParams, vnpayHashSecret);
          console.log('Standard Payment URL created:', paymentUrl);
        }
        
        // Return the payment URL and transaction reference
        return new Response(
          JSON.stringify({ 
            paymentUrl,
            txnRef: transactionRef,
            debug: {
              vnpayAmount,
              originalAmount: amountInVND,
              tmnCodeConfigured: !!vnpayTmnCode,
              returnUrlConfigured: !!vnpayReturnUrl,
              createDate,
              clientIp,
              useQR: !!useQR
            }
          }),
          { status: 200, headers }
        );
      } catch (vnpayError) {
        console.error('VNPay initialization error:', vnpayError);
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to initialize VNPay: ${vnpayError.message}`,
            stack: vnpayError.stack,
            paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?error=vnpay_init',
            txnRef: `error-${Date.now()}`
          }),
          { status: 200, headers }
        );
      }
    } catch (error) {
      console.error('Error creating VNPay payment:', error);
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to create payment: ${error.message}`,
          stack: error.stack,
          paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?error=general',
          txnRef: `error-${Date.now()}`
        }),
        { status: 200, headers }
      );
    }
  }

  // Return 200 for other methods
  return new Response(
    JSON.stringify({ 
      error: 'Method not allowed',
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?error=method',
      txnRef: `method-${Date.now()}`
    }), 
    { status: 200, headers }
  );
}); 