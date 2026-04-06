<template>
  <q-page ref="pageChat" class="page-chat flex column">

    <q-banner
  		v-if="!otherUserDetails.online"
		class="chat-status-banner chat-status-banner--offline text-center fixed-top">
      {{ otherUserDetails.name }} está offline.
    </q-banner>

    <q-banner
  	  v-else
		class="chat-status-banner chat-status-banner--online text-center">
      {{ otherUserDetails.name }} está online.
    </q-banner>

    <div v-if="chatLoading" class="chat-loading-state column items-center justify-center col q-px-lg">
      <q-spinner-dots color="primary" size="56px" />
      <div class="chat-loading-state__title">Carregando histórico...</div>
      <div class="chat-loading-state__text">A conversa está sendo preparada. Em rede lenta, isso pode levar alguns instantes.</div>
    </div>

    <div v-else-if="!messagesList.length" class="chat-empty-state column items-center justify-center col q-px-lg">
      <q-icon name="chat_bubble" size="56px" color="primary" />
      <div class="chat-empty-state__title">Ainda não há mensagens nesta conversa.</div>
      <div class="chat-empty-state__text">Envie a primeira mensagem para começar.</div>
    </div>

    <div v-else :class="{ 'invisible' : !showMessages }" class="chat-messages q-pa-md column col justify-end">
      <q-chat-message
        v-for="message in messagesList"
        :key="message.messageId"
        :bg-color="message.from == 'me' ? ($q.dark.isActive ? 'teal-9' : 'grey-3') : ($q.dark.isActive ? 'green-8' : 'green-3')"
        :text-color="message.from == 'me' ? ($q.dark.isActive ? 'white' : 'dark') : ($q.dark.isActive ? 'white' : 'dark')"
        :text="[message.text]"
        :sent="message.from == 'me'"
        :name="formatName(message)"
        class="chat-bubble"
      />
    </div>

    <q-footer elevated class="chat-footer">
      <q-toolbar class="chat-footer__toolbar">
        <q-form class="full-width" @submit.prevent="sendMessage">
          <q-input
            :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
            outlined
            rounded
            v-model="newMessage"
            @blur="scrollToBottom"
            ref="newMessage"
            label="Mensagem"
            dense
            :dark="$q.dark.isActive"
            class="chat-footer__input">
            <template v-slot:after>
              <q-btn round dense flat icon="send" color="primary" @click="sendMessage" />
            </template>
          </q-input>
        </q-form>
      </q-toolbar>
    </q-footer>

  </q-page>
</template>

<script>
  import { mapState, mapActions } from 'vuex'
  import mixinOtherUserDetails from 'src/mixins/mixin-other-user-details.js'

  const emptyUser = {
    userId: '',
    name: '',
    email: '',
    online: false
  }

  export default {
    name: 'PageChat',
    mixins: [mixinOtherUserDetails],
    data () {
      return {
        newMessage: '',
        showMessages: false
      }
    },
    computed: {
      ...mapState('store', ['messages', 'userDetails', 'chatLoading']),
      messagesList () {
        return Array.isArray(this.messages) ? this.messages : []
      },
      safeOtherUserDetails () {
        return this.otherUserDetails || emptyUser
      }
    },
    methods: {
      ...mapActions('store', ['firebaseGetMessages','firebaseStopGettingMessages','firebaseSendMessage', 'setActiveChatUser', 'markConversationAsRead']),
      async openConversation (otherUserId) {
        if (!otherUserId) {
          return
        }

        this.showMessages = false
        this.setActiveChatUser(otherUserId)
        this.markConversationAsRead(otherUserId)
        this.firebaseStopGettingMessages()
        await this.firebaseGetMessages(otherUserId)
      },
      formatName(message) {
        const nome = message.from === 'me'
          ? this.userDetails.name
          : this.safeOtherUserDetails.name

        if (!message.timestamp) return nome

        return `${nome} - ${this.formatMessageDate(message.timestamp)}`
      },
      formatMessageDate(timestamp) {
        if (!timestamp) return ''

        timestamp = timestamp.replace(',', '')
        const parts = timestamp.trim().split(/\s+/)
        const [day, month, year] = parts[0].split('/').map(Number)
        const [hour, minute, second] = parts[1].split(':').map(Number)

        // Data/hora completa da mensagem
        const messageDate = new Date(year, month - 1, day, hour, minute, second)

        // Normalizando para meia-noite no fuso do Brasil
        const msgMidnight = new Date(year, month - 1, day)
        msgMidnight.setHours(0, 0, 0, 0)

        const now = new Date()
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        todayMidnight.setHours(0,0,0,0)

        const yesterdayMidnight = new Date(todayMidnight)
        yesterdayMidnight.setDate(todayMidnight.getDate() - 1)

        // const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`
        const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`

        if (msgMidnight.getTime() === todayMidnight.getTime()) {
          return `Hoje, ${timeStr}`
        }

        if (msgMidnight.getTime() === yesterdayMidnight.getTime()) {
          return `Ontem, ${timeStr}`
        }

        return `${parts[0]}, ${timeStr}`
      },
      sendMessage () {
        if (!this.newMessage.trim()) {
          return
        }

        // Gera a data no fuso do Brasil (dd/mm/aaaa hh:mm:ss)
        const now = new Date()
        const dateBr = now.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        })

        this.firebaseSendMessage({
          message: {
            text: this.newMessage.trim(),
            from: 'me',
            timestamp: dateBr
          },
          otherUserId: this.$route.params.otherUserId
        })

        this.clearMessage()
      },
      clearMessage () {
        this.newMessage = ''
        this.$refs.newMessage.focus()
      },
      scrollToBottom () {
        let pageChat = this.$refs.pageChat.$el
        setTimeout(() => {
          window.scrollTo(0, pageChat.scrollHeight)
        }, 20);
      }
    },
    watch: {
      '$route.params.otherUserId' (value, oldValue) {
      if (!value || value === oldValue) {
        return
      }

      this.openConversation(value)
    },
      'messagesList.length' (value) {
    		if (!value) {
    			this.showMessages = false
    			return
    		}

    		this.scrollToBottom()
    		setTimeout(() => {
    			this.showMessages = true
    		}, 60)
    	}
    },
    mounted () {
      this.openConversation(this.$route.params.otherUserId)
    },
	  beforeUnmount() {
      // Limpando a caixa de mensagem, para as conversas de janelas fechadas não serem exibidas na nova janela
	  	this.firebaseStopGettingMessages()
			this.setActiveChatUser('')
	  }
  }

</script>

<style lang="stylus">
.page-chat
  min-height calc(100vh - 88px)
  background linear-gradient(180deg, rgba(239, 245, 241, 1) 0%, rgba(227, 234, 230, 1) 100%)

  &:after
    content ''
    display block
    position fixed
    left 0
    right 0
    top 0
    bottom 0
    z-index 0
    opacity 0.08
    background-image radial-gradient(circle at 100% 150%, silver 24%, white 25%, white 28%, silver 29%, silver 36%, white 36%, white 40%, transparent 40%, transparent), radial-gradient(circle at 0 150%, silver 24%, white 25%, white 28%, silver 29%, silver 36%, white 36%, white 40%, transparent 40%, transparent), radial-gradient(circle at 50% 100%, white 10%, silver 11%, silver 23%, white 24%, white 30%, silver 31%, silver 43%, white 44%, white 50%, silver 51%, silver 63%, white 64%, white 71%, transparent 71%, transparent), radial-gradient(circle at 100% 50%, white 5%, silver 6%, silver 15%, white 16%, white 20%, silver 21%, silver 30%, white 31%, white 35%, silver 36%, silver 45%, white 46%, white 49%, transparent 50%, transparent), radial-gradient(circle at 0 50%, white 5%, silver 6%, silver 15%, white 16%, white 20%, silver 21%, silver 30%, white 31%, white 35%, silver 36%, silver 45%, white 46%, white 49%, transparent 50%, transparent)
    background-size 100px 50px

.body--dark .page-chat
  background linear-gradient(180deg, rgba(14, 21, 24, 1) 0%, rgba(10, 14, 17, 1) 100%)

.page-chat .q-banner
  top 78px
  z-index 2
  opacity 0.95

.page-chat .q-message
  z-index 1

.chat-status-banner
  margin 12px auto 0
  width fit-content
  padding 8px 14px
  border-radius 999px
  box-shadow 0 10px 24px rgba(0, 0, 0, 0.08)

.chat-status-banner--online
  background rgba(129, 199, 132, 0.2)
  color #1a5d1e

.chat-status-banner--offline
  background rgba(255, 214, 102, 0.32)
  color #7d5b00

.body--dark .chat-status-banner--online
  background rgba(46, 125, 50, 0.38)
  color #d9f4dd

.body--dark .chat-status-banner--offline
  background rgba(255, 193, 7, 0.28)
  color #fff1bf

.chat-messages
  position relative
  z-index 1

.chat-loading-state
  position relative
  z-index 1
  text-align center

.chat-loading-state__title
  margin-top 18px
  font-size 1.08rem
  font-weight 700

.chat-loading-state__text
  margin-top 8px
  max-width 340px
  color #667571

.body--dark .chat-loading-state__text
  color #99a8a4

.chat-empty-state
  position relative
  z-index 1
  text-align center

.chat-empty-state__title
  margin-top 14px
  font-size 1.08rem
  font-weight 700

.chat-empty-state__text
  margin-top 8px
  max-width 320px
  color #667571

.body--dark .chat-empty-state__text
  color #99a8a4

.chat-bubble
  margin-bottom 10px

.chat-footer
  background rgba(255, 255, 255, 0.78)
  backdrop-filter blur(12px)
  border-top 1px solid rgba(7, 94, 84, 0.08)

.body--dark .chat-footer
  background rgba(11, 18, 19, 0.78)
  border-top 1px solid rgba(126, 231, 213, 0.08)

.chat-footer__toolbar
  padding 10px 12px calc(10px + env(safe-area-inset-bottom))

.chat-footer__input
  box-shadow 0 10px 22px rgba(10, 54, 49, 0.08)

</style>
