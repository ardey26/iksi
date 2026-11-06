// Copy for /tools/qr-code. The QR is a static code: it encodes the URL as typed.
export const QR_TOOL = {
  title: 'Free QR code generator, no sign-up | iksi',
  label: 'QR code generator',
  description:
    'Make a QR code for any link with iksi. Free, no account, and it runs in your browser, so your link is never uploaded. Download it as a PNG.',
  answer:
    'Paste a link, make the QR code, and download it as a PNG. It is generated in your browser, so the link never leaves your device.',
  faq: [
    {
      q: 'Do QR codes expire?',
      a: 'No. This is a static QR code: it encodes your URL directly, so it works for as long as that URL works.'
    },
    {
      q: 'Is it free?',
      a: 'Yes. No account is needed, and there is no watermark.'
    },
    {
      q: 'Is my link sent to a server?',
      a: 'No. The code is drawn in your browser, and nothing is uploaded.'
    }
  ]
};
