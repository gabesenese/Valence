-- Opt-in for auto-emailing critical alerts to the account owner. Defaults off so
-- existing users are not surprised by new mail; they enable it in Settings → Preferences.
ALTER TABLE "users" ADD COLUMN "alert_email_opt_in" BOOLEAN NOT NULL DEFAULT false;
