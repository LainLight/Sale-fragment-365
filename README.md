# Sale-fragment-365

я не знаю норм ли всё работает, юзайте на свой страх и риск!!!
Используйте кошелек v4!!!
У меня на аук все поставилось: https://fragment.com/username/pripisnoy — можете купить :)

## Что умеет

- Выставление Telegram username (NFT) на продажу через Fragment
- Продажа на срок до **365 дней (1 год)** — полностью автоматизировано
- Работает через TON Blockchain (`@ton/ton`, `@ton/crypto`, `dotenv`)
- Теперь есть локальный веб-интерфейс, где можно подставить свои значения и сид-фразу

## Быстрый старт (веб-интерфейс)

1. Установите зависимости: `npm install`
2. Запустите локальный сервер: `npm start`
3. Откройте `http://localhost:3000` и заполните форму (данные отправляются только на ваш локальный сервер)

> ⚠️ Храните сид-фразу в секрете. Не запускайте сервер на машинах, которым не доверяете.

## CLI режим

Можно выставить NFT и без интерфейса — через переменные окружения:

```bash
export MNEMONIC="слова сид фразы через пробел"
export NFT_ADDRESS="EQ..."
export PRICE_TON="500"
# при необходимости
export TON_RPC_ENDPOINT="https://toncenter.com/api/v2/jsonRPC"
export TON_API_KEY="042d..."
export DURATION="31536000"
export MIN_BID_STEP="5"
export MIN_EXTEND_TIME="3600"
export QUERY_ID="13"
export COMMISSION_TON="0.1"
export BENEFICIARY_ADDRESS="EQ..."

npm run sell
```

## Основные зависимости

| Пакет          | Версия   |
| -------------- | -------- |
| @ton/ton       | ^15.2.1  |
| @ton/crypto    | ^3.3.0   |
| dotenv         | ^16.5.0  |
| express        | ^4.19.2  |

[Файл с логикой продажи](./sell.js)
