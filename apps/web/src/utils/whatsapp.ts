const SUPPORT_WHATSAPP_PHONE = '919302228883';
const FALLBACK_WHATSAPP_MESSAGE = 'Hello Vaniki Crop, I need help';

const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const buildSupportWhatsAppUrl = (message?: string) => {
  const finalMessage = (message || FALLBACK_WHATSAPP_MESSAGE).trim() || FALLBACK_WHATSAPP_MESSAGE;
  return `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${encodeURIComponent(finalMessage)}`;
};

export const openSupportWhatsApp = (message?: string) => {
  const url = buildSupportWhatsAppUrl(message);

  if (isMobileDevice()) {
    window.location.href = url;
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};
