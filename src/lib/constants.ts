export const APP_NAME = "AutoDM";
export const REPO_URL = "https://github.com/ilramdhan/auto-dm";

/** Meta limits (Instagram API with Instagram Login). */
export const DM_MAX_CHARS = 1000;
export const COMMENT_REPLY_MAX_CHARS = 2200;
export const DM_BUTTON_TITLE_MAX = 20;

export const PASSWORD_MIN_LENGTH = 12;

/** Follow gate (button template text limit is 640). */
export const FOLLOW_GATE_TEXT_MAX = 640;
export const DEFAULT_FOLLOW_GATE_MESSAGE =
  "Hai {username}! Follow akun kami dulu ya, lalu klik tombol di bawah untuk mendapatkan link-nya.";
export const DEFAULT_FOLLOW_GATE_BUTTON_TITLE = "Saya sudah follow";
export const DEFAULT_FOLLOW_GATE_RETRY_MESSAGE =
  "Sepertinya kamu belum follow kami. Follow dulu ya, lalu klik tombol di bawah lagi.";
/** Postback payload prefix for follow gate buttons: `fg:<deliveryId>`. */
export const FOLLOW_GATE_PAYLOAD_PREFIX = "fg:";
