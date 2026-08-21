-- Lineará gets its own welcome email template so its copy (no discount, no
-- verification, catalogue/certificate-focused) can differ from Ascendra's shared
-- WELCOME_EMAIL (which carries a discount code + verification link on approval).
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'LINEARA_WELCOME';
