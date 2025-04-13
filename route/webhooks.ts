import { Request, Response } from 'express';
import { handleStatusCallback, handleTestCallback } from './shipping/ghn-webhook';
import { handlePaymentIPN, handlePaymentReturn } from './payment/vnpay-callback';

/**
 * Webhook GHN để cập nhật trạng thái đơn hàng
 */
export async function ghnStatusWebhook(req: Request, res: Response) {
  return handleStatusCallback(req, res);
}

/**
 * Webhook GHN test để kiểm tra kết nối
 */
export async function ghnTestWebhook(req: Request, res: Response) {
  return handleTestCallback(req, res);
}

/**
 * Webhook VNPay IPN (Instant Payment Notification)
 * VNPay sẽ gọi endpoint này để thông báo kết quả thanh toán
 */
export async function vnpayIPNWebhook(req: Request, res: Response) {
  return handlePaymentIPN(req, res);
}

/**
 * Webhook VNPay Return URL
 * Người dùng sẽ được chuyển hướng về endpoint này sau khi hoàn tất thanh toán
 */
export async function vnpayReturnWebhook(req: Request, res: Response) {
  return handlePaymentReturn(req, res);
} 