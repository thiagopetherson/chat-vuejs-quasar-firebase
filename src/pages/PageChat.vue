<template>
  <q-page ref="pageChat" class="page-chat app-mobile-page flex column no-wrap">

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

    <div v-else ref="messagesContainer" :class="{ 'invisible' : !showMessages }" class="chat-messages q-pa-md column col justify-end">
      <div
        v-for="message in messagesList"
        :key="message.messageId"
        class="chat-message-row"
        :id="`chat-message-${message.messageId}`"
        :class="{
          'chat-message-row--sent': message.from == 'me',
          'chat-message-row--highlighted': highlightedMessageId === message.messageId
        }"
      >
        <div
          v-if="message.replyTo && !message.deleted"
          class="chat-reply-reference"
          :class="{ 'chat-reply-reference--sent': message.from == 'me' }"
          role="button"
          tabindex="0"
          @click="scrollToRepliedMessage(message.replyTo.messageId)"
          @keyup.enter="scrollToRepliedMessage(message.replyTo.messageId)"
        >
          <div class="chat-reply-reference__author">{{ getReplyAuthorName(message.replyTo) }}</div>
          <div class="chat-reply-reference__text">{{ getMessageSnippet(message.replyTo.text) }}</div>
        </div>

        <q-chat-message
          :bg-color="message.from == 'me' ? ($q.dark.isActive ? 'teal-9' : 'grey-3') : ($q.dark.isActive ? 'green-8' : 'green-3')"
          :text-color="message.from == 'me' ? ($q.dark.isActive ? 'white' : 'dark') : ($q.dark.isActive ? 'white' : 'dark')"
          :text="[getMessageText(message)]"
          :sent="message.from == 'me'"
          :name="formatName(message)"
          class="chat-bubble"
          :class="message.from == 'me' ? 'chat-bubble--sent' : 'chat-bubble--received'"
        />

        <div
          v-if="message.editedAt && !message.deleted"
          class="chat-message-meta"
          :class="{ 'chat-message-meta--sent': message.from == 'me' }"
        >
          editada
        </div>

        <div class="chat-message-actions" :class="{ 'chat-message-actions--sent': message.from == 'me' }">
          <q-btn
            v-if="isCompactActions && (!message.deleted || canManageMessage(message))"
            flat
            round
            icon="more_horiz"
            color="grey-7"
            class="chat-message-actions__menu-btn"
            aria-label="Abrir ações da mensagem"
          >
            <q-menu class="chat-message-menu" auto-close>
              <q-list dense separator>
                <q-item v-if="!message.deleted" clickable @click="prepareReply(message)">
                  <q-item-section avatar>
                    <q-icon name="reply" color="primary" />
                  </q-item-section>
                  <q-item-section>Responder</q-item-section>
                </q-item>

                <q-item v-if="canManageMessage(message)" clickable @click="prepareEdit(message)">
                  <q-item-section avatar>
                    <q-icon name="edit" color="grey-7" />
                  </q-item-section>
                  <q-item-section>Editar</q-item-section>
                </q-item>

                <q-item v-if="canManageMessage(message)" clickable @click="removeMessage(message)">
                  <q-item-section avatar>
                    <q-icon name="delete_outline" color="negative" />
                  </q-item-section>
                  <q-item-section>Apagar</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>

          <q-btn
            v-if="!isCompactActions && !message.deleted"
            flat
            dense
            no-caps
            icon="reply"
            color="primary"
            class="chat-message-actions__btn"
            @click="prepareReply(message)"
            aria-label="Responder mensagem"
          >
            <span class="chat-message-actions__label">Responder</span>
          </q-btn>

          <q-btn
            v-if="!isCompactActions && canManageMessage(message)"
            flat
            dense
            no-caps
            icon="edit"
            color="grey-7"
            class="chat-message-actions__btn"
            @click="prepareEdit(message)"
            aria-label="Editar mensagem"
          >
            <span class="chat-message-actions__label">Editar</span>
          </q-btn>

          <q-btn
            v-if="!isCompactActions && canManageMessage(message)"
            flat
            dense
            no-caps
            icon="delete_outline"
            color="negative"
            class="chat-message-actions__btn"
            @click="removeMessage(message)"
            aria-label="Apagar mensagem"
          >
            <span class="chat-message-actions__label">Apagar</span>
          </q-btn>
        </div>
      </div>
    </div>

    <q-footer elevated class="chat-footer">
      <q-toolbar class="chat-footer__toolbar">
        <q-form class="full-width" @submit.prevent="sendMessage">
          <div v-if="editingMessage" class="chat-reply-composer" :class="{ 'chat-reply-composer--dark': $q.dark.isActive }">
            <div class="chat-reply-composer__content">
              <div class="chat-reply-composer__title">Editando sua mensagem</div>
              <div class="chat-reply-composer__text">A alteração será exibida para os dois lados da conversa.</div>
            </div>
            <q-btn flat round dense icon="close" color="grey-7" @click="cancelEdit" />
          </div>

          <div v-if="replyingToMessage" class="chat-reply-composer" :class="{ 'chat-reply-composer--dark': $q.dark.isActive }">
            <div class="chat-reply-composer__content">
              <div class="chat-reply-composer__title">Respondendo para {{ getReplyAuthorName(replyingToMessage) }}</div>
              <div class="chat-reply-composer__text">{{ getMessageSnippet(replyingToMessage.text) }}</div>
            </div>
            <q-btn flat round dense icon="close" color="grey-7" @click="cancelReply" />
          </div>

          <q-input
            :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
            outlined
            v-model="newMessage"
            ref="newMessage"
            label="Mensagem"
            dense
            :dark="$q.dark.isActive"
            inputmode="text"
            enterkeyhint="send"
            autogrow
            class="chat-footer__input">
            <template v-slot:after>
              <q-btn round flat icon="send" color="primary" @click="sendMessage" :disable="savingMessage || !newMessage.trim()" aria-label="Enviar mensagem" />
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
        showMessages: false,
        replyingToMessage: null,
        highlightedMessageId: '',
        editingMessage: null,
        savingMessage: false
      }
    },
    computed: {
      ...mapState('store', ['messages', 'userDetails', 'chatLoading']),
      isCompactActions () {
        return this.$q.screen.lt.sm
      },
      messagesList () {
        return Array.isArray(this.messages) ? this.messages : []
      },
      safeOtherUserDetails () {
        return this.otherUserDetails || emptyUser
      }
    },
    methods: {
      ...mapActions('store', ['firebaseGetMessages','firebaseStopGettingMessages','firebaseSendMessage', 'firebaseEditMessage', 'firebaseDeleteMessage', 'setActiveChatUser', 'markConversationAsRead']),
      async openConversation (otherUserId) {
        if (!otherUserId) {
          return
        }

        this.showMessages = false
        this.cancelReply()
        this.cancelEdit()
        this.setActiveChatUser(otherUserId)
        this.markConversationAsRead(otherUserId)
        this.firebaseStopGettingMessages()
        await this.firebaseGetMessages(otherUserId)
      },
      prepareReply (message) {
        if (message.deleted) {
          return
        }

        this.cancelEdit()
        this.replyingToMessage = {
          messageId: message.messageId,
          text: message.text || '',
          from: message.from,
          name: message.from === 'me' ? this.userDetails.name : this.safeOtherUserDetails.name,
          timestamp: message.timestamp || ''
        }

        this.$refs.newMessage.focus()
      },
      cancelReply () {
        this.replyingToMessage = null
      },
      canManageMessage (message) {
        return message.from === 'me' && !message.deleted
      },
      prepareEdit (message) {
        if (!this.canManageMessage(message)) {
          return
        }

        this.cancelReply()
        this.editingMessage = {
          messageId: message.messageId,
          text: message.text || ''
        }
        this.newMessage = message.text || ''
        this.$refs.newMessage.focus()
      },
      cancelEdit () {
        this.editingMessage = null
      },
      scrollToRepliedMessage (messageId) {
        if (!messageId) {
          return
        }

        const target = document.getElementById(`chat-message-${messageId}`)

        if (!target) {
          return
        }

        this.highlightedMessageId = messageId
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })

        window.clearTimeout(this.highlightTimeout)
        this.highlightTimeout = window.setTimeout(() => {
          this.highlightedMessageId = ''
        }, 1800)
      },
      getReplyAuthorName (replyMessage) {
        if (!replyMessage) {
          return ''
        }

        if (replyMessage.name) {
          return replyMessage.name
        }

        return replyMessage.from === 'me'
          ? this.userDetails.name
          : this.safeOtherUserDetails.name
      },
      getMessageSnippet (text = '') {
        const normalizedText = String(text).trim()

        if (normalizedText.length <= 90) {
          return normalizedText
        }

        return `${normalizedText.slice(0, 90)}...`
      },
      getMessageText (message) {
        return message.deleted ? 'Esta mensagem foi apagada.' : (message.text || '')
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
      async sendMessage () {
        if (!this.newMessage.trim()) {
          return
        }

        if (this.savingMessage) {
          return
        }

        this.savingMessage = true

        if (this.editingMessage) {
          const result = await this.firebaseEditMessage({
            otherUserId: this.$route.params.otherUserId,
            messageId: this.editingMessage.messageId,
            text: this.newMessage.trim()
          })

          this.savingMessage = false

          if (!result || !result.ok) {
            this.$q.notify({
              type: 'negative',
              message: result && result.error ? result.error : 'Não foi possível editar a mensagem.'
            })
            return
          }

          this.$q.notify({
            type: 'positive',
            message: 'Mensagem editada.'
          })

          this.clearMessage()
          return
        }

        // Gera a data no fuso do Brasil (dd/mm/aaaa hh:mm:ss)
        const now = new Date()
        const dateBr = now.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        })

        const result = await this.firebaseSendMessage({
          message: {
            text: this.newMessage.trim(),
            from: 'me',
            timestamp: dateBr,
            replyTo: this.replyingToMessage ? {
              ...this.replyingToMessage,
              text: this.getMessageSnippet(this.replyingToMessage.text)
            } : null
          },
          otherUserId: this.$route.params.otherUserId
        })

        this.savingMessage = false

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível enviar a mensagem.'
          })
          return
        }

        this.clearMessage()
      },
      async removeMessage (message) {
        if (!this.canManageMessage(message)) {
          return
        }

        try {
          await this.$q.dialog({
            title: 'Apagar mensagem',
            message: 'Deseja apagar esta mensagem para todos na conversa?',
            cancel: {
              flat: true,
              label: 'Cancelar'
            },
            ok: {
              color: 'negative',
              label: 'Apagar'
            },
            persistent: true
          })
        } catch (error) {
          return
        }

        const result = await this.firebaseDeleteMessage({
          otherUserId: this.$route.params.otherUserId,
          messageId: message.messageId
        })

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível apagar a mensagem.'
          })
          return
        }

        if (this.editingMessage && this.editingMessage.messageId === message.messageId) {
          this.clearMessage()
        }

        this.$q.notify({
          type: 'positive',
          message: 'Mensagem apagada.'
        })
      },
      clearMessage () {
        this.newMessage = ''
        this.cancelReply()
        this.cancelEdit()
        this.$nextTick(() => {
          this.$refs.newMessage.focus()
        })
      },
      scrollToBottom () {
        const messagesContainer = this.$refs.messagesContainer

        if (!messagesContainer) {
          return
        }

        setTimeout(() => {
          messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
          })
        }, 20)
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
      window.clearTimeout(this.highlightTimeout)
	  	this.firebaseStopGettingMessages()
			this.setActiveChatUser('')
	  }
  }

</script>

<style lang="stylus">
.page-chat
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
  border-radius 8px
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
  overflow-y auto
  overscroll-behavior contain
  padding-bottom calc(12px + env(safe-area-inset-bottom))

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

.chat-bubble--sent
  align-self flex-end

.chat-bubble--received
  align-self flex-start

.chat-bubble :deep(.q-message-container)
  max-width min(78vw, 520px)

.chat-bubble :deep(.q-message-name)
  margin-bottom 6px
  font-size 0.74rem
  letter-spacing 0.01em
  opacity 0.78

.chat-bubble--sent :deep(.q-message-text)
  background linear-gradient(180deg, rgba(235, 235, 235, 0.96) 0%, rgba(223, 223, 223, 0.96) 100%)
  border-radius 10px 10px 4px 10px
  box-shadow 0 10px 22px rgba(21, 33, 31, 0.08)

.chat-bubble--received :deep(.q-message-text)
  background linear-gradient(180deg, rgba(208, 244, 198, 0.96) 0%, rgba(188, 235, 173, 0.96) 100%)
  border-radius 10px 10px 10px 4px
  box-shadow 0 10px 22px rgba(11, 74, 44, 0.08)

.chat-bubble :deep(.q-message-text-content)
  font-size 0.95rem
  line-height 1.5

.body--dark .chat-bubble--sent :deep(.q-message-text)
  background linear-gradient(180deg, rgba(30, 43, 46, 0.96) 0%, rgba(21, 31, 34, 0.98) 100%)

.body--dark .chat-bubble--received :deep(.q-message-text)
  background linear-gradient(180deg, rgba(18, 92, 79, 0.96) 0%, rgba(12, 75, 64, 0.98) 100%)

.chat-message-row
  display flex
  flex-direction column
  align-items flex-start
  margin-bottom 10px
  transition transform 0.18s ease, filter 0.18s ease

.chat-message-row--sent
  align-items flex-end

.chat-message-row--highlighted
  filter saturate(1.15)
  transform scale(1.01)

.chat-message-row--highlighted .chat-reply-reference,
.chat-message-row--highlighted .chat-bubble :deep(.q-message-text)
  box-shadow 0 0 0 2px rgba(38, 166, 154, 0.28), 0 14px 30px rgba(10, 54, 49, 0.14)

.chat-message-actions
  display flex
  flex-wrap wrap
  justify-content flex-start
  margin-top -2px
  padding-left 8px

.chat-message-actions--sent
  justify-content flex-end
  padding-right 8px
  padding-left 0

.chat-message-actions__btn
  min-height auto
  padding 2px 6px

.chat-message-actions__menu-btn
  min-width 40px
  min-height 40px

.chat-message-menu
  border-radius 10px

.chat-message-actions__label
  margin-left 4px
  font-size 0.78rem

.chat-message-meta
  margin-top -2px
  padding-left 12px
  font-size 0.72rem
  color #70817d

.chat-message-meta--sent
  padding-right 12px
  padding-left 0
  text-align right

.body--dark .chat-message-meta
  color #98aaa6

.chat-reply-reference
  width fit-content
  max-width 52%
  margin-bottom 6px
  padding 10px 12px
  border-left 4px solid rgba(7, 94, 84, 0.72)
  border-radius 8px
  background rgba(255, 255, 255, 0.46)
  box-shadow 0 8px 20px rgba(10, 54, 49, 0.06)
  cursor pointer
  transition transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease

  &:hover,
  &:focus
    transform translateY(-1px)
    box-shadow 0 12px 24px rgba(10, 54, 49, 0.12)
    outline none

.chat-reply-reference--sent
  border-left-color rgba(129, 199, 132, 0.9)

.body--dark .chat-reply-reference
  background rgba(255, 255, 255, 0.08)

.chat-reply-reference__author
  font-size 0.78rem
  font-weight 700
  margin-bottom 4px

.chat-reply-reference__text
  font-size 0.84rem
  line-height 1.4
  opacity 0.88

.chat-footer
  background rgba(255, 255, 255, 0.78)
  backdrop-filter blur(12px)
  border-top 1px solid rgba(7, 94, 84, 0.08)

.body--dark .chat-footer
  background rgba(11, 18, 19, 0.78)
  border-top 1px solid rgba(126, 231, 213, 0.08)

.chat-footer__toolbar
  padding 10px 12px calc(10px + env(safe-area-inset-bottom))

.chat-reply-composer
  display flex
  align-items flex-start
  gap 10px
  margin-bottom 10px
  padding 10px 12px
  border-radius 8px
  background rgba(255, 255, 255, 0.86)
  border-left 4px solid rgba(7, 94, 84, 0.78)
  box-shadow 0 10px 24px rgba(10, 54, 49, 0.08)

.chat-reply-composer--dark
  background rgba(255, 255, 255, 0.06)

.chat-reply-composer__content
  flex 1
  min-width 0

.chat-reply-composer__title
  font-size 0.8rem
  font-weight 700
  margin-bottom 4px

.chat-reply-composer__text
  font-size 0.88rem
  line-height 1.4
  color #5f6d6a
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.body--dark .chat-reply-composer__text
  color #a0afac

.chat-footer__input
  box-shadow 0 10px 22px rgba(10, 54, 49, 0.08)

.chat-footer__input :deep(textarea),
.chat-footer__input :deep(input)
  max-height 140px

@media (max-width: 900px)
  .chat-reply-reference
    max-width 68%

@media (max-width: 600px)
  .chat-messages
    padding 12px 10px

  .chat-message-actions
    padding-left 4px

  .chat-message-actions--sent
    padding-right 4px

  .chat-reply-reference
    max-width 86%
    padding 8px 10px

  .chat-reply-composer
    padding 8px 10px

  .chat-footer__toolbar
    padding 8px 8px calc(8px + env(safe-area-inset-bottom))

</style>
