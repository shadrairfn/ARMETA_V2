import nodemailer from "nodemailer";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Konfigurasi transporter untuk mengirim email.
 * Gunakan akun email khusus aplikasi (bukan email pribadi utama).
 *
 * Pastikan di .env sudah diset:
 * EMAIL_USER=youremail@gmail.com
 * EMAIL_PASS=your_app_password
 */
const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

/**
 * Fungsi umum untuk mengirim email
 * @param {string} to - alamat email penerima
 * @param {string} subject - judul email
 * @param {string} html - konten email dalam format HTML
 */
const sendEmail = asyncHandler(async (to, subject, html) => {
	const mailOptions = {
		from: `"ARMETA" <${process.env.EMAIL_USER}>`,
		to,
		subject,
		html,
	};

	const info = await transporter.sendMail(mailOptions);
	console.log(`Email terkirim ke ${to}: ${info.messageId}`);
	return info;
});

/**
 * Kirim email OTP untuk verifikasi user baru
 * @param {string} email - penerima OTP
 * @param {string} otp - kode OTP
 */
const sendOTPEmail = async (email, otp) => {
	const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Verifikasi Akun ARMETA</h2>
      <p>Halo,</p>
      <p>Berikut adalah kode OTP Anda:</p>
      <h1 style="color: #2E86DE;">${otp}</h1>
      <p>Kode ini berlaku selama <b>5 menit</b>.</p>
      <p>Jika Anda tidak meminta kode ini, abaikan email ini.</p>
      <br>
      <p>Salam hangat,<br>Tim FundEarn</p>
    </div>
  `;

	return await sendEmail(email, "Verifikasi Akun Anda - ARMETA", html);
};

export { sendEmail, sendOTPEmail };
