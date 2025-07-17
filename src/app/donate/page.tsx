export default function DonatePage() {
  return (
    <div style={{ maxWidth: 600, margin: '50px auto', textAlign: 'center' }}>
      <h1>開発者にコーヒーを差し入れ ☕</h1>
      <p>このアプリを気に入っていただけたら、PayPayでのご支援をお願いします。</p>
      <img
        src="/paypay-qr.png"
        alt="PayPay QRコード"
        style={{ width: 300, marginTop: 20 }}
      />
      <p style={{ marginTop: 10 }}>PayPay ID: tsugawayamato</p>
    </div>
  );
}
