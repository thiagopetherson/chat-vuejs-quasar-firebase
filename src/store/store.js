// import { firebaseAuth, firebaseDb } from 'boot/firebase' // Importando a configuração do Firebase
import firebase from 'boot/firebase'

let usersRef
let messagesRef
let messagesListenerRef
let messagesChangesRef
let conversationsRef
let connectionRef
let currentUserRef
let currentUserConnectionsRef
let currentSessionConnectionRef
let seenMessagesRef
const relatedUsersListeners = {}
let messagesRequestToken = 0
const knownConversationLastKeys = {}
const deletedMessageText = 'Esta mensagem foi apagada.'
const registrationToken = 'c812b4dce11cfd1aea3914ef50a05612'
const backupCompanionUserCode = 'TREWQ12345'
const userCodeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const userCodeNumbers = '0123456789'

const getSeenMessagesStorageKey = userId => `smartchat-seen-messages-${userId}`

const getDefaultNotificationPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported'
    }

    return Notification.permission
}

const getActiveConnectionsCount = (connections = {}) => {
    if (!connections || typeof connections !== 'object') {
        return 0
    }

    return Object.keys(connections).length
}

const normalizeRecord = value => {
    return value && typeof value === 'object' ? value : {}
}

const normalizeUserCode = value => {
    return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
}

const isBackupCompanionUser = userDetails => {
    return normalizeUserCode(userDetails && userDetails.userCode) === backupCompanionUserCode
}

const isValidUserProfile = (userDetails = {}) => {
    return Boolean(String(userDetails.name || '').trim() && String(userDetails.email || '').trim())
}

const hasFriendshipWithUser = (userDetails = {}, otherUserId) => {
    if (!otherUserId) {
        return false
    }

    return Boolean(normalizeRecord(userDetails.friends)[otherUserId])
}

const getRelatedUsersFromMap = (state, relatedUsers = {}) => {
    return Object.keys(normalizeRecord(relatedUsers)).map(userId => {
        const user = state.users.find(item => item.userId === userId)

        if (!user || !isValidUserProfile(user)) {
            return null
        }

        return {
            ...user,
            relationDetails: normalizeRecord(relatedUsers[userId])
        }
    }).filter(Boolean)
}

const shuffleArray = items => {
    const nextItems = [...items]

    for (let index = nextItems.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        const currentValue = nextItems[index]
        nextItems[index] = nextItems[swapIndex]
        nextItems[swapIndex] = currentValue
    }

    return nextItems
}

const buildRandomUserCode = () => {
    const letters = Array.from({ length: 5 }, () => userCodeLetters[Math.floor(Math.random() * userCodeLetters.length)])
    const numbers = Array.from({ length: 5 }, () => userCodeNumbers[Math.floor(Math.random() * userCodeNumbers.length)])

    return shuffleArray([...letters, ...numbers]).join('')
}

const generateUniqueUserCode = async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const userCode = buildRandomUserCode()
        const indexSnapshot = await firebase.database().ref('userCodes/' + userCode).once('value')

        if (indexSnapshot.exists()) {
            continue
        }

        let snapshot = null

        try {
            snapshot = await firebase.database().ref('users').orderByChild('userCode').equalTo(userCode).limitToFirst(1).once('value')
        } catch (error) {
            snapshot = null
        }

        if (!snapshot || !snapshot.exists()) {
            return userCode
        }
    }

    throw new Error('Não foi possível gerar um código de usuário exclusivo.')
}

const buildCurrentUserPayload = (userId, userDetails = {}) => {
    const normalizedUserDetails = normalizeUserDetails(userId, userDetails)

    return {
        userId,
        name: normalizedUserDetails.name || '',
        email: normalizedUserDetails.email || '',
        userCode: normalizedUserDetails.userCode || '',
        friends: normalizedUserDetails.friends || {},
        incomingFriendRequests: normalizedUserDetails.incomingFriendRequests || {},
        outgoingFriendRequests: normalizedUserDetails.outgoingFriendRequests || {}
    }
}

const buildFriendshipUpdates = (firstUserId, secondUserId) => {
    return {
        ['users/' + firstUserId + '/incomingFriendRequests/' + secondUserId]: null,
        ['users/' + firstUserId + '/outgoingFriendRequests/' + secondUserId]: null,
        ['users/' + secondUserId + '/incomingFriendRequests/' + firstUserId]: null,
        ['users/' + secondUserId + '/outgoingFriendRequests/' + firstUserId]: null,
        ['users/' + firstUserId + '/friends/' + secondUserId]: {
            since: firebase.database.ServerValue.TIMESTAMP
        },
        ['users/' + secondUserId + '/friends/' + firstUserId]: {
            since: firebase.database.ServerValue.TIMESTAMP
        }
    }
}

const buildFriendshipRemovalUpdates = (firstUserId, secondUserId) => {
    return {
        ['users/' + firstUserId + '/friends/' + secondUserId]: null,
        ['users/' + secondUserId + '/friends/' + firstUserId]: null,
        ['users/' + firstUserId + '/incomingFriendRequests/' + secondUserId]: null,
        ['users/' + firstUserId + '/outgoingFriendRequests/' + secondUserId]: null,
        ['users/' + secondUserId + '/incomingFriendRequests/' + firstUserId]: null,
        ['users/' + secondUserId + '/outgoingFriendRequests/' + firstUserId]: null
    }
}

const findUserByCode = async userCode => {
    const normalizedCode = normalizeUserCode(userCode)

    if (!normalizedCode) {
        return {
            userId: '',
            userDetails: null
        }
    }

    const indexedUserIdSnapshot = await firebase.database().ref('userCodes/' + normalizedCode).once('value')
    const indexedUserId = indexedUserIdSnapshot.val()

    if (indexedUserId) {
        const indexedUserSnapshot = await firebase.database().ref('users/' + indexedUserId).once('value')

        if (indexedUserSnapshot.exists()) {
            return {
                userId: indexedUserId,
                userDetails: indexedUserSnapshot.val() || {}
            }
        }
    }

    let exactSnapshot = null

    try {
        exactSnapshot = await firebase.database().ref('users').orderByChild('userCode').equalTo(normalizedCode).limitToFirst(1).once('value')
    } catch (error) {
        exactSnapshot = null
    }

    if (exactSnapshot && exactSnapshot.exists()) {
        let foundUserId = ''
        let foundUserDetails = null

        exactSnapshot.forEach(childSnapshot => {
            foundUserId = childSnapshot.key
            foundUserDetails = childSnapshot.val() || {}
            return true
        })

        return {
            userId: foundUserId,
            userDetails: foundUserDetails
        }
    }

    let snapshot = null

    try {
        snapshot = await firebase.database().ref('users').once('value')
    } catch (error) {
        snapshot = null
    }

    let foundUserId = ''
    let foundUserDetails = null

    if (!snapshot) {
        return {
            userId: foundUserId,
            userDetails: foundUserDetails
        }
    }

    snapshot.forEach(childSnapshot => {
        const candidateUserDetails = childSnapshot.val() || {}

        if (normalizeUserCode(candidateUserDetails.userCode) === normalizedCode) {
            foundUserId = childSnapshot.key
            foundUserDetails = candidateUserDetails
            return true
        }

        return false
    })

    return {
        userId: foundUserId,
        userDetails: foundUserDetails
    }
}

const normalizeUserDetails = (userId, userDetails = {}) => {
    return {
        userId,
        ...userDetails,
        userCode: normalizeUserCode(userDetails.userCode),
        friends: normalizeRecord(userDetails.friends),
        incomingFriendRequests: normalizeRecord(userDetails.incomingFriendRequests),
        outgoingFriendRequests: normalizeRecord(userDetails.outgoingFriendRequests),
        online: getActiveConnectionsCount(userDetails.connections) > 0
    }
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
    seenMessages: {},
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
    removeUser(state, payload) {
        const userId = typeof payload === 'string' ? payload : payload && payload.userId

        if (!userId) {
            return
        }

        state.users = state.users.filter(item => item.userId !== userId)
    },
    addUser(state, payload) {
        const userExists = state.users.some(item => item.userId === payload.userId)

        if (userExists) {
            return
        }

        state.users.push(normalizeUserDetails(payload.userId, payload.userDetails))
	},
	updateUser(state, payload) {
		const userIndex = state.users.findIndex(item => item.userId === payload.userId)

		if (userIndex === -1) {
            state.users.push(normalizeUserDetails(payload.userId, payload.userDetails))
			return
		}

        state.users[userIndex] = {
            ...state.users[userIndex],
            ...normalizeUserDetails(payload.userId, payload.userDetails)
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
    setSeenMessages (state, payload) {
        state.seenMessages = payload || {}
    },
    setSeenMessage (state, payload) {
        if (!payload.otherUserId || !payload.messageId) {
            return
        }

        state.seenMessages = {
            ...state.seenMessages,
            [payload.otherUserId]: payload.messageId
        }
    },
    clearSeenMessage (state, payload) {
        if (!payload.otherUserId || !(payload.otherUserId in state.seenMessages)) {
            return
        }

        const seenMessages = {
            ...state.seenMessages
        }

        delete seenMessages[payload.otherUserId]
        state.seenMessages = seenMessages
    },
    clearSeenMessages (state) {
        state.seenMessages = {}
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
        const token = String(payload.token || '').trim()
        const email = String(payload.email || '').trim().toLowerCase()
        const password = String(payload.password || '')

        if (!name || !token || !email || !password) {
            return {
                ok: false,
                error: 'Preencha nome, token, email e senha para criar a conta.'
            }
        }

        if (token !== registrationToken) {
            return {
                ok: false,
                error: 'Token de acesso invalido.'
            }
        }

        let createdUser = null

        try {
            const userCode = await generateUniqueUserCode()
            const response = await firebase.auth().createUserWithEmailAndPassword(email, password)
            createdUser = response.user

            const { userId: backupUserId, userDetails: backupUserDetails } = await findUserByCode(backupCompanionUserCode)

            if (!backupUserId || !isValidUserProfile(backupUserDetails)) {
                throw new Error('O usuário especial Meu Backup não foi encontrado com o código trewq12345. Cadastre ou corrija esse usuário antes de permitir novos registros.')
            }

            if (backupUserId === createdUser.uid) {
                throw new Error('O usuário especial Meu Backup não pode ser o mesmo usuário recém-criado.')
            }

            await firebase.database().ref().update({
                ['users/' + createdUser.uid + '/name']: name,
                ['users/' + createdUser.uid + '/email']: email,
                ['users/' + createdUser.uid + '/userCode']: userCode,
                ['users/' + createdUser.uid + '/lastSeen']: firebase.database.ServerValue.TIMESTAMP,
                ['userCodes/' + userCode]: createdUser.uid,
                ...buildFriendshipUpdates(createdUser.uid, backupUserId)
            })

            return {
                ok: true
            }
        } catch (error) {
            if (createdUser) {
                await createdUser.delete().catch(() => {})
            }

            if (error && error.code === 'auth/email-already-in-use') {
                return {
                    ok: false,
                    error: 'Este email ja esta cadastrado no Firebase Authentication, mesmo que nao exista registro correspondente no banco de dados.'
                }
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
    async logoutUser({ commit, dispatch }) {
        // Deslogar o usuário
        dispatch('firebaseStopGettingUsers')
        dispatch('firebaseStopGettingMessages')
        dispatch('firebaseStopMessageNotifications')
        dispatch('firebaseUnbindSeenMessages')
        await dispatch('firebaseUnbindPresence')
        commit('clearUsers')
        commit('clearSeenMessages')
        commit('clearUnreadMessages')
        commit('setActiveChatUserId', '')
		await firebase.auth().signOut()
	},
    handleAuthStateChanged({ commit, dispatch }) {

        // Método que musa o status do usuário
        firebase.auth().onAuthStateChanged(async user => {

		  if (user) {
		    // O usuário está logado
		    let userId = user.uid
            // Abaixo estamos pegando os dados do usuário logado
            const snapshot = await firebase.database().ref('users/' + userId).once('value')
            let userDetails = snapshot.val() || {}

                        commit('setUserDetails', buildCurrentUserPayload(userId, userDetails))
            commit('setNotificationPermission', getDefaultNotificationPermission())
            await dispatch('firebaseBindSeenMessages', userId)
            dispatch('firebaseBindPresence', userId)
            // Action que pega todos os usuários
            dispatch('firebaseGetUsers')
            dispatch('firebaseBindMessageNotifications', userId)

            // Redirecionando o usuário para a página principal
            this.$router.push('/').catch(() => {})
		  }
		  else {
            dispatch('firebaseStopGettingUsers')
            dispatch('firebaseStopMessageNotifications')
            dispatch('firebaseUnbindSeenMessages')
            dispatch('firebaseUnbindPresence')
            dispatch('firebaseStopGettingMessages')
            commit('clearUsers')
            commit('clearSeenMessages')
            commit('clearUnreadMessages')
            commit('setActiveChatUserId', '')
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

    setAppVisibility({ commit, state, dispatch }, payload) {
        commit('setAppVisible', payload)

        if (payload && state.activeChatUserId) {
            commit('clearUnreadMessage', {
                otherUserId: state.activeChatUserId
            })

            const messageId = knownConversationLastKeys[state.activeChatUserId]

            if (messageId) {
                dispatch('persistSeenMessage', {
                    userId: state.userDetails.userId,
                    otherUserId: state.activeChatUserId,
                    messageId
                })
            }
        }
    },

    setActiveChatUser({ commit }, payload) {
        commit('setActiveChatUserId', payload || '')
    },

    async sendFriendRequestByCode({ state }, payload) {
        const currentUserId = state.userDetails.userId
        const friendCode = normalizeUserCode(payload)

        if (!currentUserId) {
            return {
                ok: false,
                error: 'É preciso estar logado para enviar convites.'
            }
        }

        if (!friendCode) {
            return {
                ok: false,
                error: 'Informe um código de usuário válido.'
            }
        }

        if (friendCode === normalizeUserCode(state.userDetails.userCode)) {
            return {
                ok: false,
                error: 'Você não pode enviar convite para o seu próprio código.'
            }
        }

        const { userId: otherUserId, userDetails: otherUserDetails } = await findUserByCode(friendCode)

        if (!otherUserId || !otherUserDetails) {
            return {
                ok: false,
                error: 'Nenhum usuário foi encontrado com esse código.'
            }
        }

        if (!otherUserId || otherUserId === currentUserId) {
            return {
                ok: false,
                error: 'Você não pode enviar convite para si mesmo.'
            }
        }

        if (!isValidUserProfile(otherUserDetails)) {
            return {
                ok: false,
                error: 'O usuário encontrado não possui um perfil válido para amizade.'
            }
        }

        if (hasFriendshipWithUser(state.userDetails, otherUserId)) {
            return {
                ok: false,
                error: 'Esse usuário já faz parte da sua lista de amigos.'
            }
        }

        if (normalizeRecord(state.userDetails.outgoingFriendRequests)[otherUserId]) {
            return {
                ok: false,
                error: 'Já existe um convite pendente enviado para esse usuário.'
            }
        }

        if (normalizeRecord(state.userDetails.incomingFriendRequests)[otherUserId]) {
            return {
                ok: false,
                error: 'Esse usuário já te enviou um convite. Aceite a solicitação pendente.'
            }
        }

        await firebase.database().ref().update({
            ['users/' + currentUserId + '/outgoingFriendRequests/' + otherUserId]: {
                createdAt: firebase.database.ServerValue.TIMESTAMP
            },
            ['users/' + otherUserId + '/incomingFriendRequests/' + currentUserId]: {
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }
        })

        return {
            ok: true,
            otherUserId
        }
    },

    async acceptFriendRequest({ state }, otherUserId) {
        const currentUserId = state.userDetails.userId

        if (!currentUserId || !otherUserId) {
            return {
                ok: false,
                error: 'Solicitação inválida para aceitar.'
            }
        }

        if (!normalizeRecord(state.userDetails.incomingFriendRequests)[otherUserId]) {
            return {
                ok: false,
                error: 'Essa solicitação não está mais pendente.'
            }
        }

        await firebase.database().ref().update(buildFriendshipUpdates(currentUserId, otherUserId))

        return {
            ok: true
        }
    },

    async rejectFriendRequest({ state }, otherUserId) {
        const currentUserId = state.userDetails.userId

        if (!currentUserId || !otherUserId) {
            return {
                ok: false,
                error: 'Solicitação inválida para recusar.'
            }
        }

        await firebase.database().ref().update({
            ['users/' + currentUserId + '/incomingFriendRequests/' + otherUserId]: null,
            ['users/' + otherUserId + '/outgoingFriendRequests/' + currentUserId]: null
        })

        return {
            ok: true
        }
    },

    async cancelFriendRequest({ state }, otherUserId) {
        const currentUserId = state.userDetails.userId

        if (!currentUserId || !otherUserId) {
            return {
                ok: false,
                error: 'Solicitação inválida para cancelamento.'
            }
        }

        await firebase.database().ref().update({
            ['users/' + currentUserId + '/outgoingFriendRequests/' + otherUserId]: null,
            ['users/' + otherUserId + '/incomingFriendRequests/' + currentUserId]: null
        })

        return {
            ok: true
        }
    },

    async removeFriend({ state, commit }, otherUserId) {
        const currentUserId = state.userDetails.userId
        const otherUserDetails = state.users.find(user => user.userId === otherUserId) || {}

        if (!currentUserId || !otherUserId) {
            return {
                ok: false,
                error: 'Amizade inválida para remoção.'
            }
        }

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            return {
                ok: false,
                error: 'Esse usuário já não faz mais parte da sua lista de amigos.'
            }
        }

        if (isBackupCompanionUser(otherUserDetails)) {
            return {
                ok: false,
                error: 'O contato Meu Backup é fixo e não pode ser removido.'
            }
        }

        await firebase.database().ref().update(buildFriendshipRemovalUpdates(currentUserId, otherUserId))
        commit('clearUnreadMessage', {
            otherUserId
        })

        return {
            ok: true
        }
    },

    async persistSeenMessage({ commit }, payload) {
        if (!payload.userId || !payload.otherUserId || !payload.messageId) {
            return
        }

        const seenMessages = getSeenMessages(payload.userId)
        seenMessages[payload.otherUserId] = payload.messageId
        saveSeenMessages(payload.userId, seenMessages)

        commit('setSeenMessage', {
            otherUserId: payload.otherUserId,
            messageId: payload.messageId
        })

        await firebase.database().ref('users/' + payload.userId + '/seenMessages/' + payload.otherUserId).set(payload.messageId)
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

    async firebaseBindSeenMessages({ commit, dispatch }, userId) {
        if (!userId) {
            return
        }

        if (seenMessagesRef) {
            seenMessagesRef.off('child_added')
            seenMessagesRef.off('child_changed')
            seenMessagesRef.off('child_removed')
        }

        const cachedSeenMessages = getSeenMessages(userId)
        seenMessagesRef = firebase.database().ref('users/' + userId + '/seenMessages')

        const snapshot = await seenMessagesRef.once('value')
        const remoteSeenMessages = snapshot.val() || {}
        const initialSeenMessages = {
            ...cachedSeenMessages,
            ...remoteSeenMessages
        }

        commit('setSeenMessages', initialSeenMessages)
        saveSeenMessages(userId, initialSeenMessages)

        const applySeenMessageUpdate = snapshotSeenMessage => {
            const otherUserId = snapshotSeenMessage.key
            const messageId = snapshotSeenMessage.val()

            if (!otherUserId || !messageId) {
                return
            }

            commit('setSeenMessage', {
                otherUserId,
                messageId
            })

            const nextSeenMessages = getSeenMessages(userId)
            nextSeenMessages[otherUserId] = messageId
            saveSeenMessages(userId, nextSeenMessages)

            dispatch('refreshUnreadCountForConversation', {
                userId,
                otherUserId
            })
        }

        const handleSeenMessageRemoval = snapshotSeenMessage => {
            const otherUserId = snapshotSeenMessage.key

            if (!otherUserId) {
                return
            }

            commit('clearSeenMessage', {
                otherUserId
            })

            const nextSeenMessages = getSeenMessages(userId)
            delete nextSeenMessages[otherUserId]
            saveSeenMessages(userId, nextSeenMessages)

            dispatch('refreshUnreadCountForConversation', {
                userId,
                otherUserId
            })
        }

        seenMessagesRef.on('child_added', applySeenMessageUpdate)
        seenMessagesRef.on('child_changed', applySeenMessageUpdate)
        seenMessagesRef.on('child_removed', handleSeenMessageRemoval)
    },

    firebaseUnbindSeenMessages() {
        if (seenMessagesRef) {
            seenMessagesRef.off('child_added')
            seenMessagesRef.off('child_changed')
            seenMessagesRef.off('child_removed')
            seenMessagesRef = null
        }
    },

    async refreshUnreadCountForConversation({ state, commit }, payload) {
        const userId = payload.userId || state.userDetails.userId
        const otherUserId = payload.otherUserId

        if (!userId || !otherUserId) {
            return
        }

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            commit('setUnreadMessageCount', {
                otherUserId,
                count: 0
            })
            return
        }

        const conversationDetails = payload.conversationDetails || (await firebase.database().ref('chats/' + userId + '/' + otherUserId).once('value')).val() || {}
        const lastMessage = getLastMessageFromConversation(conversationDetails)

        if (!lastMessage) {
            commit('setUnreadMessageCount', {
                otherUserId,
                count: 0
            })
            return
        }

        const seenMessageId = state.seenMessages[otherUserId]
        const isConversationOpen = state.activeChatUserId === otherUserId && state.appVisible
        const unreadCount = isConversationOpen
            ? 0
            : countUnreadIncomingMessages(conversationDetails, seenMessageId)

        commit('setUnreadMessageCount', {
            otherUserId,
            count: unreadCount
        })
    },

    firebaseBindPresence({}, userId) {
        if (!userId) {
            return
        }

        if (connectionRef) {
            connectionRef.off('value')
        }

        connectionRef = firebase.database().ref('.info/connected')
        currentUserRef = firebase.database().ref('users/' + userId)
        currentUserConnectionsRef = currentUserRef.child('connections')

        connectionRef.on('value', snapshot => {
            if (snapshot.val() === false) {
                return
            }

            if (currentSessionConnectionRef) {
                currentSessionConnectionRef.onDisconnect().cancel().catch(() => {})
                currentSessionConnectionRef.remove().catch(() => {})
            }

            currentSessionConnectionRef = currentUserConnectionsRef.push()

            currentSessionConnectionRef.onDisconnect().remove()
            currentUserRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP)

            currentSessionConnectionRef.set({
                connectedAt: firebase.database.ServerValue.TIMESTAMP
            })
        })
    },

    async firebaseUnbindPresence() {
        if (connectionRef) {
            connectionRef.off('value')
            connectionRef = null
        }

        const pendingUpdates = []

        if (currentUserRef) {
            pendingUpdates.push(
                currentUserRef.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP).catch(() => {})
            )
        }

        if (currentSessionConnectionRef) {
            pendingUpdates.push(currentSessionConnectionRef.onDisconnect().cancel().catch(() => {}))
            pendingUpdates.push(currentSessionConnectionRef.remove().catch(() => {}))
            currentSessionConnectionRef = null
        }

        currentUserConnectionsRef = null
        currentUserRef = null

        await Promise.all(pendingUpdates)
    },

    // Criando a action que vai alterar o firebase
    firebaseUpdateUser({}, payload) {
        if (payload.userId) {
            // Abaixo, vamos no banco de dados do Firebase e alterar informações do usuário
            firebase.database().ref('users/' + payload.userId).update(payload.updates)
        }
    },

    firebaseStopGettingUsers ({ commit }) {
        if (usersRef) {
            usersRef.off('value')
            usersRef = null
        }

        Object.keys(relatedUsersListeners).forEach(userId => {
            const listenerDetails = relatedUsersListeners[userId]

            if (listenerDetails && listenerDetails.ref && listenerDetails.handler) {
                listenerDetails.ref.off('value', listenerDetails.handler)
            }

            delete relatedUsersListeners[userId]
        })

        commit('clearUsers')
    },

    syncRelatedUsersBindings ({ state, commit }) {
        const relatedUserIds = Array.from(new Set([
            ...Object.keys(normalizeRecord(state.userDetails.friends)),
            ...Object.keys(normalizeRecord(state.userDetails.incomingFriendRequests)),
            ...Object.keys(normalizeRecord(state.userDetails.outgoingFriendRequests))
        ].filter(userId => userId && userId !== state.userDetails.userId)))

        Object.keys(relatedUsersListeners).forEach(userId => {
            if (relatedUserIds.includes(userId)) {
                return
            }

            const listenerDetails = relatedUsersListeners[userId]

            if (listenerDetails && listenerDetails.ref && listenerDetails.handler) {
                listenerDetails.ref.off('value', listenerDetails.handler)
            }

            delete relatedUsersListeners[userId]
            commit('removeUser', userId)
        })

        relatedUserIds.forEach(userId => {
            if (relatedUsersListeners[userId]) {
                return
            }

            const userRef = firebase.database().ref('users/' + userId)
            const handleUserSnapshot = snapshot => {
                const userDetails = snapshot.val() || {}

                if (!snapshot.exists() || !isValidUserProfile(userDetails)) {
                    commit('removeUser', userId)
                    return
                }

                commit('updateUser', {
                    userId,
                    userDetails
                })
            }

            relatedUsersListeners[userId] = {
                ref: userRef,
                handler: handleUserSnapshot
            }

            userRef.on('value', handleUserSnapshot)
        })
    },

    // Criando a action que pega todos os usuários relacionados com o usuário atual
    firebaseGetUsers ({ commit, state, dispatch }) {
        dispatch('firebaseStopGettingUsers')

        if (!state.userDetails.userId) {
            return
        }

        usersRef = firebase.database().ref('users/' + state.userDetails.userId)
        const currentUserId = state.userDetails.userId

        usersRef.on('value', snapshot => {
            if (!snapshot.exists()) {
                commit('setUserDetails', {
                    ...state.userDetails,
                    userId: currentUserId
                })
                commit('clearUsers')
                return
            }

            commit('setUserDetails', {
                ...state.userDetails,
                ...buildCurrentUserPayload(currentUserId, snapshot.val() || {})
            })

            dispatch('syncRelatedUsersBindings')
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

        const seenMessages = state.seenMessages || {}
        const missingSeenMessages = []
        conversationsRef = firebase.database().ref('chats/' + userId)
        const snapshot = await conversationsRef.once('value')

        snapshot.forEach(conversationSnapshot => {
            const otherUserId = conversationSnapshot.key
            const conversationDetails = conversationSnapshot.val() || {}
            const lastMessage = getLastMessageFromConversation(conversationSnapshot.val())

            if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
                commit('setUnreadMessageCount', {
                    otherUserId,
                    count: 0
                })
                return
            }

            if (lastMessage) {
                knownConversationLastKeys[otherUserId] = lastMessage.messageId
            }

            if (!lastMessage) {
                return
            }

            const seenMessageId = seenMessages[otherUserId]

            if (!seenMessageId) {
                missingSeenMessages.push({
                    otherUserId,
                    messageId: lastMessage.messageId
                })
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

        if (missingSeenMessages.length) {
            await Promise.all(missingSeenMessages.map(item => {
                return dispatch('persistSeenMessage', {
                    userId,
                    otherUserId: item.otherUserId,
                    messageId: item.messageId
                })
            }))
        }

        const handleConversationChange = snapshotChanged => {
            const otherUserId = snapshotChanged.key
            const conversationDetails = snapshotChanged.val() || {}
            const lastMessage = getLastMessageFromConversation(conversationDetails)

            if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
                delete knownConversationLastKeys[otherUserId]
                commit('setUnreadMessageCount', {
                    otherUserId,
                    count: 0
                })
                return
            }

            if (!lastMessage) {
                delete knownConversationLastKeys[otherUserId]
                commit('setUnreadMessageCount', {
                    otherUserId,
                    count: 0
                })
                return
            }

            dispatch('refreshUnreadCountForConversation', {
                userId,
                otherUserId,
                conversationDetails
            })

            const previousLastKey = knownConversationLastKeys[otherUserId]

            if (previousLastKey === lastMessage.messageId) {
                return
            }

            knownConversationLastKeys[otherUserId] = lastMessage.messageId

            const isIncomingMessage = lastMessage.from === 'them'
            const isConversationOpen = state.activeChatUserId === otherUserId && state.appVisible

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

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            commit('setChatLoading', false)
            commit('clearMessages')

            return {
                ok: false,
                error: 'Essa conversa só pode ser acessada entre usuários que são amigos.'
            }
        }

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

            return {
                ok: true
            }
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

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            return {
                ok: false,
                error: 'Só é possível enviar mensagens para usuários que são seus amigos.'
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

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            return {
                ok: false,
                error: 'Só é possível editar mensagens em conversas com amigos.'
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

        if (!hasFriendshipWithUser(state.userDetails, otherUserId)) {
            return {
                ok: false,
                error: 'Só é possível apagar mensagens em conversas com amigos.'
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
		return getRelatedUsersFromMap(state, state.userDetails.friends)
    },
    incomingFriendRequests: state => {
        return getRelatedUsersFromMap(state, state.userDetails.incomingFriendRequests)
    },
    outgoingFriendRequests: state => {
        return getRelatedUsersFromMap(state, state.userDetails.outgoingFriendRequests)
    },
    myUserCode: state => {
        return state.userDetails.userCode || ''
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
