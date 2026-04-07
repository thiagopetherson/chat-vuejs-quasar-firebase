// import { firebaseAuth, firebaseDb } from 'boot/firebase' // Importando a configuração do Firebase
import firebase from 'boot/firebase'

let usersRef
let messagesRef
let messagesListenerRef
let messagesChangesRef
let conversationsRef
let connectionRef
let currentUserPresenceRef
let messagesRequestToken = 0
const knownConversationLastKeys = {}
const deletedMessageText = 'Esta mensagem foi apagada.'

const getSeenMessagesStorageKey = userId => `smartchat-seen-messages-${userId}`

const getDefaultNotificationPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported'
    }

    return Notification.permission
}

const getLastMessageFromConversation = (conversationDetails = {}) => {
    const messageIds = Object.keys(conversationDetails)

    if (!messageIds.length) {
        return null
    }

    const messageId = messageIds[messageIds.length - 1]

    return {
        messageId,
        ...conversationDetails[messageId]
    }
}

const getSeenMessages = userId => {
    if (typeof window === 'undefined' || !userId) {
        return {}
    }

    try {
        return JSON.parse(localStorage.getItem(getSeenMessagesStorageKey(userId)) || '{}')
    } catch (error) {
        return {}
    }
}

const saveSeenMessages = (userId, payload) => {
    if (typeof window === 'undefined' || !userId) {
        return
    }

    localStorage.setItem(getSeenMessagesStorageKey(userId), JSON.stringify(payload))
}

const countUnreadIncomingMessages = (conversationDetails = {}, seenMessageId) => {
    if (!seenMessageId) {
        return 0
    }

    const messageIds = Object.keys(conversationDetails)
    const seenMessageIndex = messageIds.indexOf(seenMessageId)
    const unreadMessages = seenMessageIndex === -1
        ? messageIds
        : messageIds.slice(seenMessageIndex + 1)

    return unreadMessages.reduce((total, messageId) => {
        const messageDetails = conversationDetails[messageId] || {}
        return messageDetails.from === 'them' ? total + 1 : total
    }, 0)
}

const getBrazilTimestamp = () => {
    return new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    })
}

const getMessageMatchSignature = (messageDetails = {}) => {
    return JSON.stringify({
        timestamp: messageDetails.timestamp || '',
        text: messageDetails.text || '',
        replyTo: messageDetails.replyTo || null,
        deleted: Boolean(messageDetails.deleted)
    })
}

const resolveMirroredMessageId = async ({ currentUserId, otherUserId, messageId, currentMessage }) => {
    if (!currentUserId || !otherUserId || !messageId || !currentMessage) {
        return ''
    }

    const mirroredMessageRef = firebase.database().ref('chats/' + otherUserId + '/' + currentUserId + '/' + messageId)
    const mirroredMessageSnapshot = await mirroredMessageRef.once('value')

    if (mirroredMessageSnapshot.exists()) {
        return messageId
    }

    const conversationSnapshot = await firebase.database().ref('chats/' + otherUserId + '/' + currentUserId).once('value')
    const currentSignature = getMessageMatchSignature(currentMessage)
    let mirroredMessageId = ''

    conversationSnapshot.forEach(childSnapshot => {
        if (mirroredMessageId) {
            return true
        }

        const candidateMessage = childSnapshot.val() || {}

        if (candidateMessage.from !== 'them') {
            return false
        }

        if (getMessageMatchSignature(candidateMessage) === currentSignature) {
            mirroredMessageId = childSnapshot.key
            return true
        }

        return false
    })

    return mirroredMessageId
}

const state = {
    userDetails: {},
    users: [], // Esse estado guardada a lista de usuários
    messages: [], // Esse estado guarda as mensagens
    unreadMessages: {},
    activeChatUserId: '',
    chatLoading: false,
    appVisible: true,
    notificationPermission: getDefaultNotificationPermission()
}

const mutations = {
    setUserDetails(state, payload) {
        state.userDetails = payload
    },
    clearUsers(state) {
        state.users = []
    },
    addUser(state, payload) {
        const userExists = state.users.some(item => item.userId === payload.userId)

        if (userExists) {
            return
        }

        state.users.push({
            userId: payload.userId,
            ...payload.userDetails
        })
	},
	updateUser(state, payload) {
		const userIndex = state.users.findIndex(item => item.userId === payload.userId)

		if (userIndex === -1) {
			state.users.push({
				userId: payload.userId,
				...payload.userDetails
			})
			return
		}

		state.users[userIndex] = {
			...state.users[userIndex],
			userId: payload.userId,
			...payload.userDetails
		}
	},
    addMessage (state, payload) {
        const existingMessage = state.messages.some(message => message.messageId === payload.messageId)

        if (existingMessage) {
            return
        }

        state.messages.push({
            messageId: payload.messageId,
            ...payload.messageDetails
        })
    },
    updateMessage (state, payload) {
        const messageIndex = state.messages.findIndex(message => message.messageId === payload.messageId)

        if (messageIndex === -1) {
            return
        }

        state.messages[messageIndex] = {
            ...state.messages[messageIndex],
            ...payload.messageDetails,
            messageId: payload.messageId
        }
    },
    setMessages (state, payload) {
        state.messages = payload
    },
    clearMessages (state) {
        state.messages = []
    },
    setChatLoading (state, payload) {
        state.chatLoading = payload
    },
    setActiveChatUserId (state, payload) {
        state.activeChatUserId = payload
    },
    incrementUnreadMessage (state, payload) {
        const currentCount = state.unreadMessages[payload.otherUserId] || 0
        state.unreadMessages = {
            ...state.unreadMessages,
            [payload.otherUserId]: currentCount + 1
        }
    },
    clearUnreadMessage (state, payload) {
        if (payload.otherUserId in state.unreadMessages) {
            const unreadMessages = {
                ...state.unreadMessages
            }

            delete unreadMessages[payload.otherUserId]
            state.unreadMessages = unreadMessages
        }
    },
    clearUnreadMessages (state) {
        state.unreadMessages = {}
    },
    setUnreadMessageCount (state, payload) {
        if (!payload.count) {
            const unreadMessages = {
                ...state.unreadMessages
            }

            delete unreadMessages[payload.otherUserId]
            state.unreadMessages = unreadMessages
            return
        }

        state.unreadMessages = {
            ...state.unreadMessages,
            [payload.otherUserId]: payload.count
        }
    },
    setAppVisible (state, payload) {
        state.appVisible = payload
    },
    setNotificationPermission (state, payload) {
        state.notificationPermission = payload
    }
}

const actions = {
    async registerUser ({}, payload) {
        const name = String(payload.name || '').trim()
        const email = String(payload.email || '').trim().toLowerCase()
        const password = String(payload.password || '')

        if (!name || !email || !password) {
            return {
                ok: false,
                error: 'Preencha nome, email e senha para criar a conta.'
            }
        }

        let createdUser = null

        try {
            const response = await firebase.auth().createUserWithEmailAndPassword(email, password)
            createdUser = response.user

            await firebase.database().ref('users/' + createdUser.uid).set({
                name,
                email,
                online: true
            })

            return {
                ok: true
            }
        } catch (error) {
            if (createdUser) {
                await createdUser.delete().catch(() => {})
            }

            return {
                ok: false,
                error: error.message || 'Não foi possível concluir o registro.'
            }
        }
    },
    async loginUser({}, payload) {
        const email = String(payload.email || '').trim().toLowerCase()
        const password = String(payload.password || '')

        if (!email || !password) {
            return {
                ok: false,
                error: 'Informe email e senha para entrar.'
            }
        }

        try {
            await firebase.auth().signInWithEmailAndPassword(email, password)

            return {
                ok: true
            }
        } catch (error) {
            return {
                ok: false,
                error: error.message || 'Não foi possível fazer login.'
            }
        }
    },
    logoutUser({ commit, dispatch }) {
        // Deslogar o usuário
        dispatch('firebaseStopGettingMessages')
        dispatch('firebaseStopMessageNotifications')
        dispatch('firebaseUnbindPresence')
        commit('clearUsers')
        commit('clearUnreadMessages')
        commit('setActiveChatUserId', '')
		firebase.auth().signOut()
	},
	handleAuthStateChanged({ commit, dispatch, state }) {

        // Método que musa o status do usuário
        firebase.auth().onAuthStateChanged(async user => {

		  if (user) {
		    // O usuário está logado
		    let userId = user.uid
            // Abaixo estamos pegando os dados do usuário logado
            const snapshot = await firebase.database().ref('users/' + userId).once('value')
            let userDetails = snapshot.val() || {}

            commit('setUserDetails', {
            	name: userDetails.name || '',
            	email: userDetails.email || '',
            	userId: userId
            })
            commit('setNotificationPermission', getDefaultNotificationPermission())
            dispatch('firebaseBindPresence', userId)
            // Action que pega todos os usuários
            dispatch('firebaseGetUsers')
            dispatch('firebaseBindMessageNotifications', userId)

            // Redirecionando o usuário para a página principal
            this.$router.push('/').catch(() => {})
		  }
		  else {
            dispatch('firebaseStopMessageNotifications')
            dispatch('firebaseUnbindPresence')
            dispatch('firebaseStopGettingMessages')
            commit('clearUsers')
            commit('clearUnreadMessages')
            commit('setActiveChatUserId', '')
		  	// O usuário está deslogado
            // Vamos atualizar (no firebase) os dados do usuário quando ele logar (colocar offline, por exemplo)
            dispatch('firebaseUpdateUser', {
                userId: state.userDetails.userId,
                updates: {
                    online: false
                }
            })
            // Setando o usuário como objeto vazio
            commit('setUserDetails', {})
            // Redirecionando o usuário para a página (se logado)
            // Usando o replace (ao invés do push) para o histórico ser apagado e o usuário não conseguir voltar depois de deslogado
		  	this.$router.replace('/auth').catch(err => {})
		  }
		})
	},

    syncNotificationPermission({ commit }) {
        commit('setNotificationPermission', getDefaultNotificationPermission())
    },

    async requestNotificationPermission({ commit }) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            commit('setNotificationPermission', 'unsupported')
            return 'unsupported'
        }

        const permission = await Notification.requestPermission()
        commit('setNotificationPermission', permission)

        return permission
    },

    setAppVisibility({ commit, state }, payload) {
        commit('setAppVisible', payload)

        if (payload && state.activeChatUserId) {
            commit('clearUnreadMessage', {
                otherUserId: state.activeChatUserId
            })
        }
    },

    setActiveChatUser({ commit }, payload) {
        commit('setActiveChatUserId', payload || '')
    },

    persistSeenMessage({}, payload) {
        if (!payload.userId || !payload.otherUserId || !payload.messageId) {
            return
        }

        const seenMessages = getSeenMessages(payload.userId)
        seenMessages[payload.otherUserId] = payload.messageId
        saveSeenMessages(payload.userId, seenMessages)
    },

    markConversationAsRead({ commit, state, dispatch }, otherUserId) {
        commit('clearUnreadMessage', {
            otherUserId
        })

        const messageId = knownConversationLastKeys[otherUserId]

        if (messageId) {
            dispatch('persistSeenMessage', {
                userId: state.userDetails.userId,
                otherUserId,
                messageId
            })
        }
    },

    firebaseBindPresence({}, userId) {
        if (!userId) {
            return
        }

        if (connectionRef) {
            connectionRef.off('value')
        }

        connectionRef = firebase.database().ref('.info/connected')
        currentUserPresenceRef = firebase.database().ref('users/' + userId)

        connectionRef.on('value', snapshot => {
            if (snapshot.val() === false) {
                return
            }

            currentUserPresenceRef.onDisconnect().update({
                online: false
            })

            currentUserPresenceRef.update({
                online: true
            })
        })
    },

    firebaseUnbindPresence() {
        if (connectionRef) {
            connectionRef.off('value')
            connectionRef = null
        }

        currentUserPresenceRef = null
    },

    // Criando a action que vai alterar o firebase
    firebaseUpdateUser({}, payload) {
        if (payload.userId) {
            // Abaixo, vamos no banco de dados do Firebase e alterar informações do usuário
            firebase.database().ref('users/' + payload.userId).update(payload.updates)
        }
    },

    // Criando a action que pega todos os usuários
    firebaseGetUsers ({ commit }) {
        if (usersRef) {
            usersRef.off()
        }

        commit('clearUsers')
        usersRef = firebase.database().ref('users')

        // Quando é adicionado algo novo
        usersRef.on('child_added', snapshot => {
            let userDetails = snapshot.val()
            let userId = snapshot.key
            commit('addUser', {
                userId,
                userDetails
            })
        })

        // Quando é modificado algo
		usersRef.on('child_changed', snapshot => {
			let userDetails = snapshot.val()
			let userId = snapshot.key
			commit('updateUser', {
				userId,
				userDetails
			})
		})
    },
    async firebaseBindMessageNotifications({ state, commit, dispatch }, userIdParam) {
        const userId = userIdParam || state.userDetails.userId

        if (!userId) {
            return
        }

        if (conversationsRef) {
            conversationsRef.off('child_added')
            conversationsRef.off('child_changed')
        }

        Object.keys(knownConversationLastKeys).forEach(key => {
            delete knownConversationLastKeys[key]
        })

        commit('clearUnreadMessages')

        const seenMessages = getSeenMessages(userId)
        const nextSeenMessages = {
            ...seenMessages
        }
        let shouldPersistSeenMessages = false
        conversationsRef = firebase.database().ref('chats/' + userId)
        const snapshot = await conversationsRef.once('value')

        snapshot.forEach(conversationSnapshot => {
            const otherUserId = conversationSnapshot.key
            const conversationDetails = conversationSnapshot.val() || {}
            const lastMessage = getLastMessageFromConversation(conversationSnapshot.val())

            if (lastMessage) {
                knownConversationLastKeys[otherUserId] = lastMessage.messageId
            }

            if (!lastMessage) {
                return
            }

            const seenMessageId = seenMessages[otherUserId]

            if (!seenMessageId) {
                nextSeenMessages[otherUserId] = lastMessage.messageId
                shouldPersistSeenMessages = true
                return
            }

            const unreadCount = countUnreadIncomingMessages(conversationDetails, seenMessageId)

            if (unreadCount > 0) {
                commit('setUnreadMessageCount', {
                    otherUserId,
                    count: unreadCount
                })
            }
        })

        if (shouldPersistSeenMessages) {
            saveSeenMessages(userId, nextSeenMessages)
        }

        const handleConversationChange = snapshotChanged => {
            const otherUserId = snapshotChanged.key
            const conversationDetails = snapshotChanged.val() || {}
            const lastMessage = getLastMessageFromConversation(conversationDetails)

            if (!lastMessage) {
                delete knownConversationLastKeys[otherUserId]
                commit('setUnreadMessageCount', {
                    otherUserId,
                    count: 0
                })
                return
            }

            const seenMessages = getSeenMessages(userId)
            const seenMessageId = seenMessages[otherUserId]
            const isConversationOpen = state.activeChatUserId === otherUserId && state.appVisible
            const unreadCount = isConversationOpen
                ? 0
                : countUnreadIncomingMessages(conversationDetails, seenMessageId)

            commit('setUnreadMessageCount', {
                otherUserId,
                count: unreadCount
            })

            const previousLastKey = knownConversationLastKeys[otherUserId]

            if (previousLastKey === lastMessage.messageId) {
                return
            }

            knownConversationLastKeys[otherUserId] = lastMessage.messageId

            const isIncomingMessage = lastMessage.from === 'them'

            if (isIncomingMessage && !isConversationOpen) {
                dispatch('notifyNewMessage', {
                    otherUserId,
                    message: lastMessage
                })
            }
        }

        conversationsRef.on('child_added', handleConversationChange)
        conversationsRef.on('child_changed', handleConversationChange)
    },

    firebaseStopMessageNotifications({ commit }) {
        if (conversationsRef) {
            conversationsRef.off('child_added')
            conversationsRef.off('child_changed')
            conversationsRef = null
        }

        Object.keys(knownConversationLastKeys).forEach(key => {
            delete knownConversationLastKeys[key]
        })
    },

    notifyNewMessage({ state, dispatch }, payload) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return
        }

        if (Notification.permission !== 'granted') {
            return
        }

        const otherUser = state.users.find(user => user.userId === payload.otherUserId)
        const notificationTitle = otherUser ? otherUser.name : 'Nova mensagem'
        const notification = new Notification(notificationTitle, {
            body: payload.message.text || 'Você recebeu uma nova mensagem.',
            tag: 'smartchat-' + payload.otherUserId,
            renotify: true
        })

        notification.onclick = () => {
            window.focus()
            dispatch('markConversationAsRead', payload.otherUserId)

            if (this.$router) {
                this.$router.push('/chat/' + payload.otherUserId).catch(() => {})
            }

            notification.close()
        }
    },
    // Criando a action que pega as mensagens de um determinado usuário
    async firebaseGetMessages({ commit, state, dispatch }, otherUserId) {
        const currentRequestToken = ++messagesRequestToken

        let userId = state.userDetails.userId
        messagesRef = firebase.database().ref('chats/' + userId + '/' + otherUserId)
        commit('setChatLoading', true)

        try {
            const snapshot = await messagesRef.once('value')

            if (currentRequestToken !== messagesRequestToken) {
                return
            }

            const messages = []
            let lastMessageKey = null

            snapshot.forEach(childSnapshot => {
                lastMessageKey = childSnapshot.key
                messages.push({
                    messageId: childSnapshot.key,
                    ...childSnapshot.val()
                })
            })

            commit('setMessages', messages)
            commit('clearUnreadMessage', {
                otherUserId
            })

            if (lastMessageKey) {
                dispatch('persistSeenMessage', {
                    userId: userId,
                    otherUserId,
                    messageId: lastMessageKey
                })
            }

            messagesListenerRef = messagesRef.limitToLast(1)
            messagesChangesRef = messagesRef
            let skipCurrentLastMessage = Boolean(lastMessageKey)

            messagesListenerRef.on('child_added', snapshotMessage => {
                if (skipCurrentLastMessage && snapshotMessage.key === lastMessageKey) {
                    skipCurrentLastMessage = false
                    return
                }

                skipCurrentLastMessage = false
                let messageDetails = snapshotMessage.val()
                let messageId = snapshotMessage.key

                commit('addMessage', {
                    messageId,
                    messageDetails
                })

                if (messageDetails.from === 'them') {
                    commit('clearUnreadMessage', {
                        otherUserId
                    })
                    dispatch('persistSeenMessage', {
                        userId: userId,
                        otherUserId,
                        messageId
                    })
                }
            })

            messagesChangesRef.on('child_changed', snapshotMessage => {
                let messageDetails = snapshotMessage.val()
                let messageId = snapshotMessage.key

                commit('updateMessage', {
                    messageId,
                    messageDetails
                })
            })
        } finally {
            if (currentRequestToken === messagesRequestToken) {
                commit('setChatLoading', false)
            }
        }
    },
    // Action que limpa a conversa (para quando abrir a janela, a conversa anterior não ser exibida na janela atual)
    firebaseStopGettingMessages({ commit }) {
        messagesRequestToken += 1

        if (messagesListenerRef) {
            messagesListenerRef.off('child_added') // Desligando o ouvinte
            messagesListenerRef = null
        }

        if (messagesChangesRef) {
            messagesChangesRef.off('child_changed')
            messagesChangesRef = null
        }

        messagesRef = null
        commit('setChatLoading', false)
        commit('clearMessages')
	},
    async firebaseSendMessage({ state }, payload) {
        const currentUserId = state.userDetails.userId
        const otherUserId = payload.otherUserId

        if (!currentUserId || !otherUserId) {
            return {
                ok: false,
                error: 'Conversa inválida para envio da mensagem.'
            }
        }

        const messageId = firebase.database().ref('chats/' + currentUserId + '/' + otherUserId).push().key
        const message = {
            ...payload.message,
            sharedId: messageId
        }
        const mirroredMessage = {
            ...message,
            from: 'them'
        }

        await firebase.database().ref().update({
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId]: message,
            ['chats/' + otherUserId + '/' + currentUserId + '/' + messageId]: mirroredMessage
        })

        return {
            ok: true,
            messageId
        }
    },
    async firebaseEditMessage({ state }, payload) {
        const currentUserId = state.userDetails.userId
        const otherUserId = payload.otherUserId
        const messageId = payload.messageId
        const nextText = String(payload.text || '').trim()

        if (!currentUserId || !otherUserId || !messageId || !nextText) {
            return {
                ok: false,
                error: 'Mensagem inválida para edição.'
            }
        }

        const ownMessageRef = firebase.database().ref('chats/' + currentUserId + '/' + otherUserId + '/' + messageId)
        const ownMessageSnapshot = await ownMessageRef.once('value')

        if (!ownMessageSnapshot.exists()) {
            return {
                ok: false,
                error: 'A mensagem não foi encontrada.'
            }
        }

        const currentMessage = ownMessageSnapshot.val() || {}

        if (currentMessage.from !== 'me' || currentMessage.deleted) {
            return {
                ok: false,
                error: 'Só é possível editar mensagens enviadas por você.'
            }
        }

        const mirroredMessageId = await resolveMirroredMessageId({
            currentUserId,
            otherUserId,
            messageId,
            currentMessage
        })

        const editedAt = getBrazilTimestamp()
        const updates = {
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/text']: nextText,
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/editedAt']: editedAt
        }

        if (mirroredMessageId) {
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/text'] = nextText
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/editedAt'] = editedAt
        }

        await firebase.database().ref().update(updates)

        return {
            ok: true
        }
    },
    async firebaseDeleteMessage({ state }, payload) {
        const currentUserId = state.userDetails.userId
        const otherUserId = payload.otherUserId
        const messageId = payload.messageId

        if (!currentUserId || !otherUserId || !messageId) {
            return {
                ok: false,
                error: 'Mensagem inválida para remoção.'
            }
        }

        const ownMessageRef = firebase.database().ref('chats/' + currentUserId + '/' + otherUserId + '/' + messageId)
        const ownMessageSnapshot = await ownMessageRef.once('value')

        if (!ownMessageSnapshot.exists()) {
            return {
                ok: false,
                error: 'A mensagem não foi encontrada.'
            }
        }

        const currentMessage = ownMessageSnapshot.val() || {}

        if (currentMessage.from !== 'me' || currentMessage.deleted) {
            return {
                ok: false,
                error: 'Só é possível apagar mensagens enviadas por você.'
            }
        }

        const mirroredMessageId = await resolveMirroredMessageId({
            currentUserId,
            otherUserId,
            messageId,
            currentMessage
        })

        const deletedAt = getBrazilTimestamp()
        const deletionPayload = {
            text: deletedMessageText,
            deleted: true,
            deletedAt,
            editedAt: null,
            replyTo: null
        }
        const updates = {
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/text']: deletionPayload.text,
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/deleted']: deletionPayload.deleted,
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/deletedAt']: deletionPayload.deletedAt,
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/editedAt']: null,
            ['chats/' + currentUserId + '/' + otherUserId + '/' + messageId + '/replyTo']: null
        }

        if (mirroredMessageId) {
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/text'] = deletionPayload.text
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/deleted'] = deletionPayload.deleted
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/deletedAt'] = deletionPayload.deletedAt
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/editedAt'] = null
            updates['chats/' + otherUserId + '/' + currentUserId + '/' + mirroredMessageId + '/replyTo'] = null
        }

        await firebase.database().ref().update(updates)

        return {
            ok: true
        }
    }
}

const getters = {
    // Vai retornar a lista de  usuários, menos o que está logado
    users: state => {
		let usersFiltered = []
		state.users.forEach(item => {

			if (item.userId !== state.userDetails.userId) {
				usersFiltered.push(item)
			}
		})

		return usersFiltered
    },
    unreadTotal: state => {
        return Object.values(state.unreadMessages).reduce((total, count) => total + count, 0)
    }
}

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}
