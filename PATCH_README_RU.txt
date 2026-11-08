SCHOOL ATTENDANCE — AUTH / UPDATE PATCH 1.2.1
================================================

Этот архив содержит ТОЛЬКО изменённые/новые файлы. node_modules, package.json,
package-lock.json и .env.local НЕ включены. Повторно устанавливать зависимости
через npm install не требуется.

ФАЙЛЫ ДЛЯ ЗАМЕНЫ/ДОБАВЛЕНИЯ
1. frontend/src/pages/App.tsx       — вход, регистрация, показать/скрыть пароль,
                                      сброс пароля, проверка роли, уведомление об обновлении.
2. frontend/src/styles.css          — стили новых элементов.
3. firestore.rules                  — безопасное создание собственного профиля только
                                      со статусом PENDING_APPROVAL и ролью PENDING.
4. frontend/public/version.json     — версия и список изменений (НОВЫЙ ФАЙЛ).

КАК ПРИМЕНИТЬ
1. Останови dev-сервер в PowerShell: Ctrl+C.
2. Сделай копию этих четырёх текущих файлов.
3. Распакуй архив в:
   D:\Projects\SCHOOL_ATTENDANCE\school-attendance
   с сохранением структуры папок и подтверждением замены файлов.
4. Не удаляй node_modules, .env.local, package-lock.json и другие файлы проекта.
5. В PowerShell из папки проекта выполни:
   npm.cmd run build
   npm.cmd test
6. Для работы регистрации нужно опубликовать обновлённые Firestore Rules:
   firebase deploy --only firestore:rules
   (Firebase CLI должен быть авторизован в правильном проекте school-attendance-a4778.)
7. Запусти:
   npm.cmd run dev

ВАЖНО ПРО РОЛИ И ЕДИНСТВЕННОГО SUPER ADMIN
- Публичная регистрация создаёт только профиль role=PENDING, status=PENDING_APPROVAL.
- Такой пользователь не получает доступ к рабочей части приложения до назначения роли.
- Роль нельзя выбрать в форме регистрации и нельзя поменять из браузера.
- Вход разрешён только при наличии серверного custom claim role:
  SUPER_ADMIN, ADMINISTRATOR, EMPLOYEE или PARENT.
- В проекте уже есть одноразовый backend bootstrap createSuperAdmin с блокировкой
  _system/bootstrap. Он требует настроенных Secret Manager секретов и развёрнутых
  Cloud Functions. Он должен использоваться только для создания ЕДИНСТВЕННОГО
  SUPER_ADMIN. Не запускай повторную инициализацию и не назначай эту роль вручную
  через клиент или Firestore.
- Пользователь, которого ты добавил вручную в Authentication, сам по себе ещё
  не является Super Admin: Authentication account != trusted role/custom claim.
  Не удаляй его до решения, каким способом будет выполнена безопасная первичная
  настройка Super Admin.

ОБНОВЛЕНИЯ
- Приложение проверяет /version.json примерно раз в минуту.
- Если версия в version.json отличается от версии клиента 1.2.1, появится кнопка
  «Обновить», которая перезагрузит страницу и загрузит новую сборку.
- При каждом следующем релизе разработчик должен обновить версию клиента в App.tsx
  и версию в frontend/public/version.json.

ОГРАНИЧЕНИЯ
- Это локальный патч интерфейса и правил. Он не развёртывает Cloud Functions.
- Cloud Functions требуют плана Firebase Blaze для развёртывания; не переключай
  тариф и не подключай оплату без отдельного согласия владельца проекта.
- Пароль никогда не сохраняется в Firestore.
