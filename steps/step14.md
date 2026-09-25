# step14 — Auth

## Файлы
backend/app/modules/auth/model.py
backend/app/modules/auth/schema.py
backend/app/modules/auth/service.py
backend/app/modules/auth/router.py
backend/app/core/security.py
backend/scripts/create_superadmin.py

## Что сделать
1. Модель Admin: id, email (unique), password_hash, role (ADMIN/SUPER_ADMIN), created_at, is_active.
2. security.py: hash_password, verify_password (passlib[bcrypt]), create_access_token, decode_token (JWT).
3. router.py: POST /api/auth/login → {access_token}.
4. dependencies.py: get_current_admin, require_superadmin.
5. create_superadmin.py: читает ADMIN_EMAIL/ADMIN_PASSWORD из env, создаёт.
6. Пароли — только хеши. Никаких plaintext.

## Проверка
- login с верным паролем → JWT.
- /api/admin/* без токена → 401.
- в БД password_hash начинается с $2b$.