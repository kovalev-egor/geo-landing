# Гео-лендинги

Несколько лендингов на Cloudflare Pages. При открытии страницы Pages Function выбирает текст и картинку по стране, региону и A/B-варианту, записывает показ в D1 и отдаёт готовый HTML. Картинки лежат рядом с лендингом и раздаются сетью Cloudflare как обычные статические файлы.

Админка на `/admin` показывает список лендингов, показы, клики, конверсию, разбивку по вариантам и странам, а также детальную статистику выбранного лендинга.

## Структура

```text
├── functions/
│   ├── _middleware.js          # защита админки и редирект с сырого HTML
│   ├── index.js                # главная, лендинг default
│   ├── _lib/                   # гео, A/B, шаблоны, D1, отдача страницы
│   ├── api/
│   │   ├── click.js            # POST /api/click
│   │   ├── landings.js         # GET /api/landings
│   │   ├── stats.js            # GET /api/stats?id=
│   │   └── logout.js
│   └── l/[id].js               # /l/{landing-id}
├── public/
│   ├── _routes.json            # картинки и css не гоняют через Functions
│   ├── landings/
│   │   ├── _registry.json      # список лендингов для админки
│   │   ├── landing-1/          # Northline
│   │   ├── landing-2/          # Atelier Sol
│   │   └── default/            # Waypoint, открывается на /
│   ├── admin/index.html
│   ├── css/
│   └── js/
│       ├── track.js
│       └── admin.js
├── schema.sql
├── wrangler.toml
└── package.json
```

Каталог `functions/_lib` не становится маршрутом: Cloudflare не считает маршрутами файлы и папки, имя которых начинается с `_`.

## Как это работает

1. Запрос на `/` или `/l/landing-1` попадает в Pages Function.
2. Функция читает `index.html` и `config.json` этого лендинга через binding `ASSETS`.
3. Страна и регион берутся из `request.cf`. В локальной разработке их можно подменить query-параметрами, если `GEO_PREVIEW=1`.
4. Вариант A или B берётся из cookie `glab_{id}`. Если cookie нет, вариант выбирается случайно и сохраняется на 30 дней.
5. В шаблон подставляются заголовок, текст, кнопка и путь к картинке. Слой региона перекрывает слой страны, слой страны перекрывает текст по умолчанию.
6. Показ пишется в D1. Клик по основной кнопке уходит в `/api/click`, и гео для клика снова определяется на сервере.

HTML персональный, поэтому он отдаётся с `Cache-Control: private, no-store`. Файлы из `landings/{id}/images/` в `_routes.json` исключены из Functions и кэшируются как статика на edge.

Прямой заход на `/landings/landing-1/` или `index.html` переадресует на `/l/landing-1`, чтобы посетитель не увидел сырые плейсхолдеры. `config.json` снаружи не отдаётся.

## Локальный запуск

Нужны Node.js 20+ и аккаунт Cloudflare только для удалённой базы и деплоя. Локально всё поднимается без аккаунта.

В проекте зафиксирован Wrangler 3.105. Более новый workerd собран с glibc 2.35 и не стартует на Ubuntu 20.04 и старом WSL. На системе с glibc 2.35+ можно поставить свежий Wrangler, код Pages Functions от этого не меняется.

```bash
cd geo-landings
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run dev
```

`npm run dev` берёт `database_id` из `wrangler.toml` и подключает ту же локальную D1, что и `npm run db:migrate`. Если поменять id в конфиге, заново выполните миграцию.

Сайт откроется на `http://127.0.0.1:8788`.

| Адрес | Что это |
| --- | --- |
| `/` | Waypoint, лендинг `default` |
| `/l/landing-1` | Northline |
| `/l/landing-2` | Atelier Sol |
| `/l/landing-1?country=DE` | Немецкий текст и немецкая картинка |
| `/l/landing-1?country=US&region=CA` | Региональный вариант Калифорнии |
| `/l/landing-1?country=JP&variant=B` | Япония и вариант B, cookie при этом не перезаписывается |
| `/l/landing-2?country=FR` | Французская версия Atelier Sol |
| `/l/landing-2?country=BR` | Бразильская версия |
| `/admin/` | Админка |

`?country=` и `?variant=` работают только при `GEO_PREVIEW=1`. Для продакшена эту переменную не задавайте: иначе любой посетитель сможет подменить страну в аналитике. На сервере Cloudflare страна берётся из сети, а не из браузера.

Проверка чистых функций без сервера:

```bash
npm run check
```

## Как создать и подключить D1

Локальная база для `npm run dev` создаётся командой `npm run db:migrate`. Она применяет `schema.sql` к локальному D1 из `wrangler.toml`.

Удалённая база:

```bash
npx wrangler login
npx wrangler d1 create geo-landings
```

Команда напечатает `database_id`. Вставьте его в `wrangler.toml` вместо `00000000-0000-0000-0000-000000000000`. Имя binding должно остаться `DB`: функции читают `env.DB`.

Затем создайте таблицы в удалённой базе:

```bash
npm run db:migrate:remote
```

Таблицы:

- `landings` — id, название, время первой записи
- `pageviews` — показ, вариант, страна, регион, город, время
- `clicks` — то же самое для клика по основной кнопке

Регион и город добавлены к минимальному набору полей: контент умеет зависеть от региона, и эту же геометку полезно видеть в аналитике. Строка в `landings` создаётся сама при первом показе или клике. Список в админке при этом берётся из `public/landings/_registry.json`, поэтому лендинг виден и до первого визита.

## Как задеплоить

```bash
npx wrangler pages project create geo-landings --production-branch main
npx wrangler pages secret put ADMIN_KEY
npm run deploy
```

`ADMIN_KEY` — длинная случайная строка. Не кладите её в `wrangler.toml`. Локально она живёт в `.dev.vars`, на Pages — в секрете проекта.

После деплоя сайт будет на `https://geo-landings.pages.dev` или на том поддомене, который покажет Wrangler. Свой домен не нужен.

Повторный деплой — снова `npm run deploy`. Новый лендинг попадает на сайт только после деплоя: Functions не сканируют диск проекта в рантайме, они читают файлы уже опубликованной статики.

Бесплатного тарифа хватает для этого проекта: Pages, Functions и D1 входят в Cloudflare Free. У Functions на бесплатном плане есть суточный лимит запросов (сейчас 100 000 в день), у D1 — лимиты на чтение и запись. Картинки в этот лимит не входят, HTML и `/api/*` входят.

## Как зайти в админку

Откройте `/admin/`.

Способы входа:

- форма на странице, ключ из `ADMIN_KEY`;
- разовая ссылка `/admin/?key=ВАШ_КЛЮЧ` — ключ запишется в HttpOnly-cookie на 7 дней, а из адреса исчезнет.

Локальный ключ из `.dev.vars.example` — `dev-admin-key`.

В списке у каждого лендинга есть показы, клики, конверсия, варианты A/B и топ стран. Ссылка на название открывает детальную страницу: те же цифры, полный список стран, города и столбцы показов по дням (UTC). Переключатели «Всё время», «7 дней» и «30 дней» фильтруют и список, и карточку лендинга. «Выйти» очищает cookie.

Кнопка на лендинге шлёт клик через `public/js/track.js`. Гео клика на проде берётся из запроса Cloudflare. В режиме превью скрипт передаёт страну, которую сервер уже подставил в страницу, чтобы показ и клик не разъехались по разным странам.

## Как добавить новый лендинг

1. Скопируйте папку, например `public/landings/landing-1`, в `public/landings/my-landing`.
2. Имя папки — это id: латиница в нижнем регистре, цифры и дефис, до 64 символов.
3. Положите картинки в `public/landings/my-landing/images/`. Подойдут svg, png, jpg, webp, gif и avif.
4. Поправьте `index.html`. Вёрстка и стили страницы живут в этом файле. Общие вещи — только сброс стилей, фокус и статус клика в `/css/landing.css`.
5. Опишите варианты в `config.json`.
6. Добавьте объект в массив `public/landings/_registry.json`: `id`, `name` и короткий `blurb` для карточки в админке.
7. Задеплойте проект или обновите локальный `npm run dev`.

Плейсхолдеры в `index.html`:

| Плейсхолдер | Откуда берётся |
| --- | --- |
| `{{headline}}`, `{{subheadline}}`, `{{eyebrow}}`, `{{cta}}`, `{{done}}`, `{{proof}}` | тексты варианта и гео |
| `{{hero}}` | путь к картинке внутри этого лендинга |
| `{{lang}}` | язык страницы, например `de` или `ja` |
| `{{landing_id}}`, `{{variant}}`, `{{country}}`, `{{region}}`, `{{city}}` | служебные значения для `track.js` |
| `{{preview}}` | плашка превью, только если включён `GEO_PREVIEW` |

Тексты экранируются. В `{{hero}}` принимается только путь вида `/landings/{id}/images/file.png`.

Минимальный `config.json`:

```json
{
  "id": "my-landing",
  "name": "My Landing",
  "variants": {
    "A": {
      "default": {
        "lang": "en",
        "eyebrow": "New",
        "headline": "Headline A",
        "subheadline": "Longer text.",
        "cta": "Continue",
        "done": "Saved",
        "proof": "Ships this week",
        "hero": "/landings/my-landing/images/hero-a.svg"
      },
      "geo": {
        "DE": {
          "lang": "de",
          "headline": "Überschrift",
          "cta": "Weiter",
          "hero": "/landings/my-landing/images/hero-de.svg"
        },
        "US-CA": {
          "headline": "California headline"
        }
      }
    },
    "B": {
      "default": {
        "lang": "en",
        "headline": "Headline B",
        "subheadline": "The other offer.",
        "cta": "Start",
        "done": "Saved",
        "proof": "Another proof line",
        "hero": "/landings/my-landing/images/hero-b.svg"
      }
    }
  }
}
```

Ключ `US` — страна. Ключ `US-CA` — штат или регион (`request.cf.regionCode`) и перекрывает страну. Поля, которые в гео-слое не указаны, остаются из `default` этого варианта.

На странице должна быть одна основная кнопка:

```html
<button class="cta" type="button" data-track="cta" data-done="{{done}}">{{cta}}</button>
<script src="/js/track.js" defer></script>
```

И атрибуты на `<body>`: `data-landing-id`, `data-variant`, `data-country`, `data-region`, `data-city`. Их уже подставляет шаблон, если скопировать готовый лендинг.

Страница откроется на `/l/my-landing`. Отдельный маршрут в `functions/` создавать не нужно.

## Примеры в репозитории

- **Northline** (`landing-1`) — куртка. Страны US, DE, JP и регион US-CA меняют текст и картинку. Вариант B короче варианта A.
- **Atelier Sol** (`landing-2`) — запись на гончарный круг. FR и BR меняют язык и цену.
- **Waypoint** (`default`) — тихие карты. Открывается на `/` и на `/l/default`. Для GB есть отдельный текст и картинка.
