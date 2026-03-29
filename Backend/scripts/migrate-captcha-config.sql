-- Migrate setRecapchaLogin from old format {"enable": 1} to new multi-portal format
UPDATE param_config
SET params = '{"enable": 1, "portal": {"admin": {"type": "self-hosted", "active": 1}, "seller": {"type": "self-hosted", "active": 1}, "client": {"type": "captcha-google", "active": 1}}}'
WHERE name = 'setRecapchaLogin';
