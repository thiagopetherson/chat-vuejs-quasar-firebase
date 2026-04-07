# SmartChat

Aplicação de chat em tempo real construída com Vue, Quasar e Firebase.

O projeto foi pensado como um chat privado e direto, com foco em conversas entre poucas pessoas, interface limpa e boa experiência em navegador e PWA.

## Demo

- Aplicação: https://tpchat.netlify.app/

## Principais funcionalidades

- Autenticação com Firebase Auth
- Lista de contatos com status online/offline
- Conversas em tempo real com Firebase Realtime Database
- Indicadores de mensagens não lidas
- Notificações locais no navegador
- Aviso de mensagens pendentes ao abrir o app
- Responder mensagens
- Editar mensagens enviadas
- Apagar mensagens enviadas
- Dark mode com persistência local
- Interface adaptada para uso mobile e PWA

## Stack

- Vue 3
- Quasar Framework 2
- Vuex 4
- Firebase Auth
- Firebase Realtime Database

## Como rodar localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Rode em desenvolvimento

```bash
npx quasar dev
```

O app será iniciado por padrão em `http://localhost:8080`.

## Build de produção

### SPA / Web

```bash
npx quasar build -m spa
```

### Build padrão do Quasar

```bash
npx quasar build
```


## Screenshots

![Tela de Login](<Screenshot from 2026-04-06 21-15-23.png>)

![Lista de Contatos](<Screenshot from 2026-04-06 21-13-43.png>)

![Tela de Conversa](<Screenshot from 2026-04-06 21-17-58.png>)

## Referências

- Quasar: https://quasar.dev/
- Firebase: https://firebase.google.com/
