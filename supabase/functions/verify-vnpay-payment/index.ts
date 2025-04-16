import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { VNPay } from 'https://esm.sh/vnpay@2.2.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Initialize VNPay client
const vnpay = new VNPay({
  tmnCode: Deno.env.get('VNPAY_TMN_CODE')!,
  secureSecret: Deno.env.get('VNPAY_HASH_SECRET')!,
  vnpayHost: Deno.env.get('VNPAY_URL')!.replace('/paymentv2/vpcpay.html', ''),
  
  // Configuration options
  testMode: Deno.env.get('APP_ENV') !== 'production',
  hashAlgorithm: 'sha512',
  enableLog: true,
  
  // Endpoints
  endpoints: {
    paymentEndpoint: 'paymentv2/vpcpay.html',
    queryDrRefundEndpoint: 'merchant_webapi/api/transaction',
    getBankListEndpoint: 'qrpayauth/api/merchant/get_bank_list',
  }
});

// Function to handle VNPay payment verification
async function verifyVNPayPayment(req: Request): Promise<Response> {
  try {
    // Get parameters from request - either from URL or body
    let vnpParams: Record<string, string> = {};
    
    // Check if this is a GET or POST request
    if (req.method === 'GET') {
      // Extract parameters from URL
      const url = new URL(req.url);
      url.searchParams.forEach((value, key) => {
        vnpParams[key] = value;
      });
    } else {
      // Extract parameters from request body
      vnpParams = await req.json();
    }
    
    // Verify signature
    const isValidSignature = vnpay.verifyReturnUrl(vnpParams);
    
    // Get transaction reference and response code
    const txnRef = vnpParams['vnp_TxnRef'];
    const responseCode = vnpParams['vnp_ResponseCode'];
    
    if (!txnRef) {
      return new Response(
        JSON.stringify({ 
          isSuccess: false, 
          message: 'Missing transaction reference' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Find the order related to this transaction
    const { data: paymentData, error: paymentError } = await supabaseClient
      .from('vnpay_payments')
      .select('order_id')
      .eq('vnp_txn_ref', txnRef)
      .single();
    
    if (paymentError || !paymentData) {
      return new Response(
        JSON.stringify({ 
          isSuccess: false, 
          message: 'Transaction not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const orderId = paymentData.order_id;
    
    // Update payment status based on response code
    let status = 'failed';
    let isSuccess = false;
    
    if (responseCode === '00' && isValidSignature) {
      status = 'success';
      isSuccess = true;
      
      // Update order payment status
      await supabaseClient
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);
      
      // Additional processing for successful payment
      // Move files from temp to order folder if needed
      try {
        const { data: orderData } = await supabaseClient
          .from('orders')
          .select('anonymous_id')
          .eq('id', orderId)
          .single();
        
        if (orderData && orderData.anonymous_id) {
          // For file processing, this would need to be handled by another function
          // or via a webhook since Deno/Edge functions may not have direct file system access
        }
      } catch (fileError) {
        console.error('Error processing files after payment:', fileError);
        // Continue even if file processing fails
      }
    } else {
      // Update order payment status to failed
      await supabaseClient
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', orderId);
    }
    
    // Update payment record with status and response
    await supabaseClient
      .from('vnpay_payments')
      .update({
        transaction_status: status,
        response_data: vnpParams,
      })
      .eq('vnp_txn_ref', txnRef);
    
    return new Response(
      JSON.stringify({
        isSuccess,
        message: isSuccess ? 'Payment successful' : 'Payment failed',
        orderId,
        responseCode,
        transactionId: vnpParams['vnp_TransactionNo'] || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying VNPay payment:', error);
    
    return new Response(
      JSON.stringify({ 
        isSuccess: false, 
        message: `Failed to verify payment: ${error.message}` 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Handle HTTP requests
serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }
  
  // Handle GET and POST requests
  if (req.method === 'GET' || req.method === 'POST') {
    return await verifyVNPayPayment(req);
  }
  
  // Return 405 for other methods
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
    status: 405, 
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    } 
  });
}); 