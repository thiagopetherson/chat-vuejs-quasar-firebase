// import { firebaseAuth, firebaseDb } from 'boot/firebase' // Importando a configuração do Firebase
import Vue from 'vue'
import firebase from 'boot/firebase'

let messagesRef

const state = {
    userDetails: {},
    users: [], // Esse estado guardada a lista de usuários
    messages: [] // Esse estado guarda as mensagens
}

const mutations = {
    setUserDetails(state, payload) {
        state.userDetails = payload
    },
    addUser(state, payload) {
        //console.log(state)
        // console.log(payload)
        // state.userDetails = payload.userDetails
        // state.users = state.users
		//Vue.set(state.users, payload.userId, payload.userDetails)
        // state.userDetails = payload.userDetails
        state.users.push({
            userId: payload.userId,
            ...payload.userDetails
        })
        // console.log(payload)        
	},
	updateUser(state, payload) {       

        // Atualizando a lista de usuários (do estado) caso haja alguma mudança no banco de dados do firebase

        state.users.forEach((item, key) => {            
           
			if (item.userId === payload.userId) { 
                state.users[key].userId = payload.userId             
				state.users[key].name = payload.userDetails.name
                state.users[key].email = payload.userDetails.email
                state.users[key].online = payload.userDetails.online
			}        
             
		})       
          
		// Object.assign(state.users[payload.userId], payload.userDetails)
	},
    addMessage (state, payload) {
        //Vue.set(state.messages, payload.massageId, payload.messageDetails)
        state.messages.push({
            messageId: payload.massageId,
            ...payload.messageDetails
        })
    },
    clearMessages (state) {
        state.messages = []
    }
}

const actions = {
    registerUser ({}, payload) {

        // Registrando o usuário
        firebase.auth().createUserWithEmailAndPassword(payload.email, payload.password)
        .then(response => {
            console.log(response)
            // Pegando o id do usuário registrando (para além do Auth, registrarmos na tabela users)
            let userId = response.user.uid
            firebase.database().ref('users/' + userId).set({
                name: payload.name,
                email: payload.email,
                online: true
            })

        }).catch(error => {
            console.log(error.message)
        })
    },
    loginUser({}, payload) {        
       
        // Logando o usuário
        firebase.auth().signInWithEmailAndPassword(payload.email, payload.password)
        .then(response => {
            console.log(response)    
        }).catch(error => {
            console.log(error.message)
        })
    },
	logoutUser() {
        // Deslogar o usuário
        state.users = []
		firebase.auth().signOut()
	},
	handleAuthStateChanged({ commit, dispatch, state }) {

        // Método que musa o status do usuário
		firebase.auth().onAuthStateChanged(user => {      
            
		  if (user) {
		    // O usuário está logado           
		    let userId = user.uid
            // Abaixo estamos pegando os dados do usuário logado
		    firebase.database().ref('users/' + userId).once('value', snapshot => {
		    	let userDetails = snapshot.val()
                // console.log(userDetails)
		    	commit('setUserDetails', {
		    		name: userDetails.name,
		    		email: userDetails.email,
		    		userId: userId
		    	})
		    })		 
            // Vamos atualizar (no firebase) os dados do usuário quando ele logar (colocar online, por exemplo)
            dispatch('firebaseUpdateUser', {
                userId: userId,
                updates: {
                    online: true
                }
            })
            // Action que pega todos os usuários
            dispatch('firebaseGetUsers')

            // Redirecionando o usuário para a página principal
            this.$router.push('/')
		  }
		  else {            
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

    // Criando a action que vai alterar o firebase
    firebaseUpdateUser({}, payload) {
        if (payload.userId) {
            // Abaixo, vamos no banco de dados do Firebase e alterar informações do usuário
            firebase.database().ref('users/' + payload.userId).update(payload.updates)
        }
    },

    // Criando a action que pega todos os usuários
    firebaseGetUsers ({ commit }) {
        // Quando é adicionado algo novo
        firebase.database().ref('users').on('child_added', snapshot => {
            let userDetails = snapshot.val()
            let userId = snapshot.key
            //console.log(userDetails)
            //console.log(userId)
            commit('addUser', {
                userId,
                userDetails
            })
        })
        
        // Quando é modificado algo
        firebase.database().ref('users').on('child_changed', snapshot => {
			let userDetails = snapshot.val()
			let userId = snapshot.key
			commit('updateUser', {
				userId,
				userDetails
			})
		})
    },
    // Criando a action que pega as mensagens de um determinado usuário
    firebaseGetMessages({ commit, state }, otherUserId) {
		let userId = state.userDetails.userId        
		messagesRef = firebase.database().ref('chats/' + userId + '/' + otherUserId)
		messagesRef.on('child_added', snapshot => { // Isso é disparado toda ver que uma nova mensagem é adicionada
			let messageDetails = snapshot.val()
			let messageId = snapshot.key
            //console.log(messageDetails)
            //console.log(messageId)
			commit('addMessage', {
				messageId,
				messageDetails
			})
		})
	},
    // Action que limpa a conversa (para quando abrir a janela, a conversa anterior não ser exibida na janela atual)
    firebaseStopGettingMessages({ commit }) {
		if (messagesRef) {
			messagesRef.off('child_added') // Desligando o ouvinte
			commit('clearMessages')
		}
	},
    firebaseSendMessage({}, payload) {
        firebase.database().ref('chats/' + state.userDetails.userId + '/' + payload.otherUserId).push(payload.message)
        // Esse .push do firebase, adiciona um novo item com um novo id no final da lista lá do banco (com um id aleatório)

        payload.message.from = 'them'
        firebase.database().ref('chats/' + payload.otherUserId + '/' + state.userDetails.userId).push(payload.message)
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
	}
}

export default {
    namespaced: true,
    state, 
    mutations,
    actions,
    getters
}