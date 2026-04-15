# SmartChat

Aplicação de chat em tempo real construída com Vue, Quasar e Firebase.

O projeto foi pensado como um chat privado e direto, com foco em conversas entre poucas pessoas, interface limpa e boa experiência em navegador e PWA.

## Demo

- Aplicação: https://tpchat.netlify.app/

## Principais funcionalidades

- Autenticação com Firebase Auth
- Lista de amigos com status online/offline
- Convites pendentes por userCode
- Contato especial Meu Backup adicionado automaticamente em novos registros
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

## Regras do Realtime Database

O repositório agora inclui [database.rules.json](database.rules.json) e [firebase.json](firebase.json) para publicar regras alinhadas ao modelo de amizades.

Fluxo recomendado:

```bash
npx firebase login
npx firebase use <seu-project-id>
npx firebase deploy --only database
```

Essas regras foram pensadas para:

- impedir leitura em lista da raiz `users`
- permitir busca por código via `userCodes/{USERCODE}`
- restringir leitura e escrita de chats a amizades mútuas
- manter convites e amizades dentro dos caminhos usados pela aplicação

## Migração manual de usuários antigos

Antes de publicar as regras, preencha o índice `userCodes` para os usuários antigos. Sem isso, a busca por código fica dependente do fallback legado.

Exemplo de estrutura mínima para um usuário antigo `uid-antigo-1` já amigo do usuário especial `uid-meu-backup`:

```json
{
	"users": {
		"uid-antigo-1": {
			"name": "Thiago",
			"email": "thiago@example.com",
			"userCode": "AB12C34D56",
			"friends": {
				"uid-meu-backup": {
					"since": 1713135600000
				}
			}
		},
		"uid-meu-backup": {
			"name": "Meu Backup",
			"email": "backup@example.com",
			"userCode": "TREWQ12345",
			"friends": {
				"uid-antigo-1": {
					"since": 1713135600000
				}
			}
		}
	},
	"userCodes": {
		"AB12C34D56": "uid-antigo-1",
		"TREWQ12345": "uid-meu-backup"
	}
}
```

Pontos obrigatórios na migração:

- o `userCode` deve estar normalizado em maiúsculas com 10 caracteres
- cada `userCode` precisa ter seu espelho em `userCodes/{CODE}`
- o usuário especial `Meu Backup` precisa existir com o código `TREWQ12345`
- se quiser amizades já prontas, grave os dois lados em `friends`

## Desfazer amizade

Agora a tela principal de amizades permite desfazer amizade diretamente pelo menu de cada contato.

- ao desfazer, os dois lados perdem o vínculo
- convites pendentes entre o par também são limpos
- o contato especial `Meu Backup` permanece fixo e não pode ser removido


## Screenshots

![Tela de Login](<Screenshot from 2026-04-06 21-15-23.png>)

![Lista de Contatos](<Screenshot from 2026-04-06 21-13-43.png>)

![Tela de Conversa](<Screenshot from 2026-04-06 21-17-58.png>)

## Referências

- Quasar: https://quasar.dev/
- Firebase: https://firebase.google.com/
