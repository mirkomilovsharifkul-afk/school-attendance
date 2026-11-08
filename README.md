# SCHOOL ATTENDANCE V6

Веб-приложение для управления школьной посещаемостью. Архитектура: React + TypeScript + Vite, Firebase Authentication, Cloud Firestore и Cloud Functions. Часовой пояс школы — `Asia/Tashkent`.

> **Статус этой поставки:** исходный код и рабочая основа приложения созданы. Это не сертифицированная Production-система и не завершённая реализация всех 24 блоков исходного ТЗ. Для реального запуска нужны Firebase-проект, серверные секреты, настройка MFA/email-провайдера и дальнейшая реализация перечисленных ниже модулей. Не используйте сборку для обработки реальных персональных данных детей до завершения проверки безопасности.

## Возможности, реализованные в коде

- React-интерфейс с адаптивной светлой темой и переключением RU / UZ / EN.
- Вход через Firebase Authentication.
- Разделы Dashboard, Посещаемость, Ученики, Классы, Отчёты и Настройки.
- Чтение школьных данных из Firestore с фильтрацией по schoolId.
- Серверная Cloud Function для сохранения отметок с проверкой роли, школы, класса и принадлежности ученика.
- Защита от дублирования отметки за ученика и учебную дату.
- Серверная проверка окна редактирования: `createdAt + 5 часов`; ровно на пятом часу изменение запрещается.
- История изменения статуса и Audit Log.
- Отдельная процедура Super Admin для корректировки заблокированной отметки без изменения исходной записи.
- Firestore Rules с запретом клиентской записи и deny-by-default.
- Тесты чистой функции вычисления 5-часовой блокировки.
- Telegram полностью отсутствует.

## Что ещё не реализовано и не должно считаться готовым

Полная CRUD-панель школы/классов/учеников/сотрудников/родителей, приглашения и одноразовые регистрационные коды, полноценная MFA-верификация Super Admin, email OTP и реальная отправка email, родительский кабинет с серверной связью детей, полный экспорт XLSX/PDF, резервное копирование и восстановление, расширенная аналитика, все сценарии раннего ухода/прогулов, полный набор security/integration/e2e тестов и Production deployment. Кнопки/экраны, для которых эти backend-модули ещё не созданы, не заявляются как работающие.

## Требования

- Node.js 20+ (проверяйте актуальную совместимость Firebase CLI).
- npm 10+.
- Firebase project. Для Cloud Functions и реальной email-интеграции может потребоваться тариф Blaze; платные ресурсы не подключаются автоматически.
- Firebase CLI: `npm install -g firebase-tools`.

## Установка

```bash
# из корня SCHOOL_ATTENDANCE_V6_FULL
npm install
cp .env.example frontend/.env.local
```

Заполните `frontend/.env.local` Firebase Web App конфигурацией. Эти значения являются публичными идентификаторами Firebase Web SDK, но правила Firestore и серверная авторизация всё равно обязательны. Не помещайте пароли и приватные ключи в `VITE_*` переменные.

```bash
npm run dev
```

Откройте `http://localhost:5173`.

## Локальная разработка с Firebase Emulator Suite

```bash
npm install -g firebase-tools
firebase login
firebase use --add
npm run emulators
```

В `frontend/.env.local` установите `VITE_USE_EMULATORS=true`, затем запустите `npm run dev`. В эмуляторе нужно создать тестового пользователя и назначить custom claims через доверенный Admin SDK seed-скрипт; такой seed-процесс для всех ролей в этой версии ещё не включён.

## Сборка и тесты

```bash
npm run build
npm test
npm run lint
```

Тесты backend запускаются Node Test Runner после компиляции TypeScript. Полный тестовый набор из ТЗ ещё не реализован. Не трактуйте отсутствующие тесты как PASS.

## Firebase настройка

1. Создайте проект Firebase и Web App.
2. Включите Email/Password в Authentication.
3. Создайте Firestore в выбранном регионе.
4. Установите Firebase CLI и выполните `firebase use --add`.
5. Настройте Cloud Functions secrets для bootstrap:

```bash
firebase functions:secrets:set SUPER_ADMIN_LOGIN
firebase functions:secrets:set SUPER_ADMIN_EMAIL
firebase functions:secrets:set SUPER_ADMIN_PASSWORD
```

Пароль bootstrap должен содержать минимум 14 символов, верхний и нижний регистр, цифру и спецсимвол. Вызов `createSuperAdmin` — одноразовый bootstrap endpoint. Ограничьте его сетевой доступ/вызов в инфраструктуре до использования; добавьте подтверждение email и обязательное MFA enrollment до выдачи полноценного доступа. В текущей поставке этот OTP/MFA lifecycle ещё не завершён.

6. Разверните правила и индексы: `npm run deploy:rules`.
7. Соберите и разверните функции: `npm run build`, затем `npm run deploy:functions`.

## Основные серверные функции

- `saveAttendance`: первоначальное сохранение отметок.
- `updateAttendance`: изменение в пределах 5 часов с причиной и аудитом.
- `correctLockedAttendance`: только Super Admin; создаёт отдельную корректировку, не переписывает оригинал.
- `createSuperAdmin`: одноразовая bootstrap-инициализация.

Все изменения посещаемости выполняются через Cloud Functions. Firestore Rules запрещают клиентскую запись. Для Production дополнительно требуется закрыть/ограничить bootstrap endpoint, реализовать полноценный MFA/OTP и протестировать правила на Firebase Emulator Suite.

## Переменные окружения

См. `.env.example`. Frontend использует только `VITE_FIREBASE_*` и `VITE_USE_EMULATORS`. Секреты Cloud Functions задаются через Firebase Secret Manager, а не через frontend.

## ZIP

Архив содержит исходный код, конфигурацию Firebase, правила, индексы, тесты и инструкции. `node_modules`, реальные ключи, пароли и персональные данные не включены.
