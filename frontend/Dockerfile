# Frontend собирается ЛОКАЛЬНО (npm run build), т.к. node-стадия
# в docker виснет на npm install в этом окружении.
# Перед сборкой образа: npm run build (VITE_* запекаются из окружения).
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
