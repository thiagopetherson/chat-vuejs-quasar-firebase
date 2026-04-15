<template>
  <q-page class="users-page app-mobile-page q-pa-md">
    <div class="users-shell q-mx-auto">
      <div class="users-hero q-mb-md">
        <div class="users-hero__copy">
          <div class="users-hero__eyebrow">Amizades</div>
          <div class="users-hero__title">Adicione amigos por código e converse só com quem aceitou seu convite.</div>
          <div class="users-hero__subtitle">Seu SmartChat agora mostra apenas amigos confirmados.</div>

          <div class="users-hero__highlight">
            <q-icon name="verified_user" size="16px" />
            <span>Conversas mais privadas e organizadas</span>
          </div>
        </div>

        <div class="users-hero__meta">
          <q-badge class="users-hero__badge" color="primary" text-color="white">
            {{ usersList.length }} {{ usersList.length === 1 ? 'amigo' : 'amigos' }}
          </q-badge>

          <div class="users-hero__code-wrap">
            <div class="users-hero__code-label">Seu código</div>

            <q-chip
              clickable
              outline
              square
              color="primary"
              text-color="primary"
              icon="content_copy"
              class="users-hero__code-chip"
              :disable="!myUserCode"
              @click="copyOwnCode"
            >
              {{ myUserCode || 'Indisponível' }}
            </q-chip>
          </div>
        </div>
      </div>

      <div class="users-panel users-panel--soft users-panel--collapsible q-mb-md">
        <q-expansion-item
          dense
          expand-separator
          switch-toggle-side
          :default-opened="false"
          class="request-expansion request-expansion--composer"
          header-class="request-expansion__header"
        >
          <template v-slot:header>
            <q-item-section>
              <div class="users-panel__eyebrow">Novo amigo</div>
              <div class="request-expansion__title">Enviar convite por userCode</div>
            </q-item-section>

            <q-item-section side>
              <q-icon name="person_add" color="primary" size="20px" />
            </q-item-section>
          </template>

          <div class="users-panel__body">
            <q-form class="users-add-form" @submit.prevent="submitFriendRequest">
              <q-input
                v-model="friendCode"
                outlined
                dense
                label="Código do amigo"
                maxlength="10"
                autocomplete="off"
                autocapitalize="characters"
                autocorrect="off"
                spellcheck="false"
                class="users-add-form__input"
                :dark="$q.dark.isActive"
                :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                @input="normalizeFriendCode"
              />

              <q-btn
                color="primary"
                no-caps
                unelevated
                dense
                class="users-add-form__btn"
                type="submit"
                :loading="submittingFriendRequest"
                :disable="submittingFriendRequest || friendCode.length !== 10"
                label="Enviar convite"
              />
            </q-form>

            <div class="users-panel__hint">Peça o código de 10 caracteres do outro usuário. O convite só vira amizade quando ele aceitar.</div>
          </div>
        </q-expansion-item>
      </div>

      <div v-if="incomingRequests.length" class="users-panel users-panel--soft users-panel--collapsible q-mb-md">
        <q-expansion-item
          dense
          expand-separator
          switch-toggle-side
          class="request-expansion request-expansion--incoming"
          header-class="request-expansion__header"
        >
          <template v-slot:header>
            <q-item-section>
              <div class="users-panel__eyebrow">Recebidos</div>
              <div class="request-expansion__title">{{ incomingRequests.length }} {{ incomingRequests.length === 1 ? 'convite pendente para aceitar' : 'convites pendentes para aceitar' }}</div>
            </q-item-section>

            <q-item-section side>
              <q-badge color="orange-8" text-color="white">{{ incomingRequests.length }}</q-badge>
            </q-item-section>
          </template>

          <q-list class="users-list users-list--embedded" separator>
            <q-item v-for="user in incomingRequests" :key="`incoming-${getUserId(user)}`" class="users-list__item users-list__item--static users-list__item--request">
              <q-item-section avatar>
                <q-avatar color="orange-8" text-color="white" class="users-list__avatar users-list__avatar--request">
                  {{ getUserInitial(user) }}
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="users-list__name">{{ getUserName(user) }}</q-item-label>
                <q-item-label caption class="users-list__email">{{ getUserEmail(user) }}</q-item-label>
              </q-item-section>

              <q-item-section side class="users-list__side users-list__side--actions">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="negative"
                  class="users-list__action-btn users-list__action-btn--ghost"
                  label="Recusar"
                  :loading="isActionLoading('reject', getUserId(user))"
                  :disable="isUserBusy(getUserId(user))"
                  @click="handleIncomingRequest('reject', getUserId(user))"
                />
                <q-btn
                  color="primary"
                  no-caps
                  unelevated
                  dense
                  class="users-list__action-btn"
                  label="Aceitar"
                  :loading="isActionLoading('accept', getUserId(user))"
                  :disable="isUserBusy(getUserId(user))"
                  @click="handleIncomingRequest('accept', getUserId(user))"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </div>

      <div v-if="outgoingRequests.length" class="users-panel users-panel--soft users-panel--collapsible q-mb-md">
        <q-expansion-item
          dense
          expand-separator
          switch-toggle-side
          class="request-expansion request-expansion--outgoing"
          header-class="request-expansion__header"
        >
          <template v-slot:header>
            <q-item-section>
              <div class="users-panel__eyebrow">Enviados</div>
              <div class="request-expansion__title">{{ outgoingRequests.length }} {{ outgoingRequests.length === 1 ? 'convite aguardando resposta' : 'convites aguardando resposta' }}</div>
            </q-item-section>

            <q-item-section side>
              <q-badge color="blue-8" text-color="white">{{ outgoingRequests.length }}</q-badge>
            </q-item-section>
          </template>

          <q-list class="users-list users-list--embedded" separator>
            <q-item v-for="user in outgoingRequests" :key="`outgoing-${getUserId(user)}`" class="users-list__item users-list__item--static users-list__item--request">
              <q-item-section avatar>
                <q-avatar color="blue-8" text-color="white" class="users-list__avatar users-list__avatar--request">
                  {{ getUserInitial(user) }}
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="users-list__name">{{ getUserName(user) }}</q-item-label>
                <q-item-label caption class="users-list__email">{{ getUserEmail(user) }}</q-item-label>
              </q-item-section>

              <q-item-section side class="users-list__side users-list__side--actions">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="grey-7"
                  class="users-list__action-btn users-list__action-btn--ghost"
                  label="Cancelar"
                  :loading="isActionLoading('cancel', getUserId(user))"
                  :disable="isUserBusy(getUserId(user))"
                  @click="handleOutgoingCancel(getUserId(user))"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </div>

      <div v-if="usersList.length" class="users-panel">
        <div class="users-panel__header">
          <div>
            <div class="users-panel__eyebrow">Amigos</div>
            <div class="users-panel__title">Escolha alguém para iniciar uma conversa</div>
          </div>
        </div>

        <q-list class="users-list" separator>
          <q-item v-for="user in usersList" :key="getUserId(user)" :to="'/chat/' + getUserId(user)" clickable v-ripple class="users-list__item" :class="{ 'users-list__item--unread': getUserUnreadCount(user) > 0 }">
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" class="users-list__avatar">
                {{ getUserInitial(user) }}
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label class="users-list__name">{{ getUserName(user) }}</q-item-label>
              <q-item-label caption class="users-list__email">{{ getUserSecondaryText(user) }}</q-item-label>
            </q-item-section>

            <q-item-section side class="users-list__side">
              <q-badge v-if="getUserUnreadCount(user) > 0" color="negative" text-color="white" class="users-list__unread">
                {{ getUserUnreadCount(user) }}
              </q-badge>
              <q-badge :color="getUserOnline(user) ? 'light-green-5' : 'grey-5'" :text-color="getUserOnline(user) ? 'dark' : 'white'" class="users-list__status">
                {{ getUserOnline(user) ? 'Online' : 'Offline' }}
              </q-badge>

              <q-btn
                v-if="!isBackupUser(user)"
                flat
                round
                dense
                icon="more_vert"
                color="grey-7"
                class="users-list__menu-btn"
                :loading="isActionLoading('remove', getUserId(user))"
                :disable="isUserBusy(getUserId(user))"
                @click.stop
              >
                <q-menu auto-close class="users-friend-menu">
                  <q-list dense separator>
                    <q-item clickable @click="handleRemoveFriend(getUserId(user))">
                      <q-item-section avatar>
                        <q-icon name="person_remove" color="negative" />
                      </q-item-section>
                      <q-item-section>Desfazer amizade</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <div v-else class="users-empty column items-center justify-center">
        <q-icon name="group_add" size="52px" color="primary" />
        <div class="users-empty__title">Você ainda não tem amigos adicionados.</div>
        <div class="users-empty__text">Use o código de um usuário para enviar um convite. Quando ele aceitar, a conversa aparece aqui.</div>
      </div>
    </div>
  </q-page>
</template>

<script>
  import { mapActions, mapGetters } from 'vuex'

  export default {
    name: 'PageUsers',
    data () {
      return {
        friendCode: '',
        submittingFriendRequest: false,
        activeRequestActionKey: ''
      }
    },
    computed: {
      ...mapGetters('store', ['myUserCode']),
      usersList () {
        const users = this.$store.getters['store/users']
        const unreadMessages = this.$store.state.store.unreadMessages || {}

        return (Array.isArray(users) ? users : []).map(user => ({
          userId: this.getUserId(user),
          name: this.getUserName(user),
          email: this.getUserEmail(user),
          userCode: this.getUserCode(user),
          online: this.getUserOnline(user),
          unreadCount: unreadMessages[this.getUserId(user)] || 0
        })).sort((firstUser, secondUser) => {
          const firstUserIsBackup = this.isBackupUser(firstUser)
          const secondUserIsBackup = this.isBackupUser(secondUser)

          if (firstUserIsBackup !== secondUserIsBackup) {
            return firstUserIsBackup ? -1 : 1
          }

          if (firstUser.unreadCount !== secondUser.unreadCount) {
            return secondUser.unreadCount - firstUser.unreadCount
          }

          return firstUser.name.localeCompare(secondUser.name)
        })
      },
      incomingRequests () {
        const requests = this.$store.getters['store/incomingFriendRequests'] || []
        return [...requests].sort((firstUser, secondUser) => this.getRelationCreatedAt(secondUser) - this.getRelationCreatedAt(firstUser))
      },
      outgoingRequests () {
        const requests = this.$store.getters['store/outgoingFriendRequests'] || []
        return [...requests].sort((firstUser, secondUser) => this.getRelationCreatedAt(secondUser) - this.getRelationCreatedAt(firstUser))
      }
    },
    methods: {
      ...mapActions('store', ['sendFriendRequestByCode', 'acceptFriendRequest', 'rejectFriendRequest', 'cancelFriendRequest', 'removeFriend']),
      getUserId (user) {
        return user && user.userId ? user.userId : ''
      },
      getUserCode (user) {
        return user && user.userCode ? String(user.userCode).trim() : ''
      },
      getUserName (user) {
        return user && user.name ? String(user.name).trim() : ''
      },
      getUserEmail (user) {
        return user && user.email ? String(user.email).trim() : ''
      },
      getUserInitial (user) {
        return this.getUserName(user).charAt(0).toUpperCase() || '?'
      },
      getUserUnreadCount (user) {
        return user && user.unreadCount ? user.unreadCount : 0
      },
      getUserOnline (user) {
        return Boolean(user && user.online)
      },
      getRelationCreatedAt (user) {
        return Number(user && user.relationDetails && user.relationDetails.createdAt ? user.relationDetails.createdAt : 0)
      },
      isBackupUser (user) {
        return this.getUserCode(user).replace(/[^a-z0-9]/gi, '').toUpperCase() === 'TREWQ12345'
      },
      getUserSecondaryText (user) {
        const unreadCount = this.getUserUnreadCount(user)

        if (unreadCount > 0) {
          return `${unreadCount} ${unreadCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
        }

        if (this.isBackupUser(user)) {
          return 'Seu espaço pessoal de backup'
        }

        return this.getUserEmail(user)
      },
      normalizeFriendCode () {
        this.friendCode = String(this.friendCode || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10)
      },
      isActionLoading (action, userId) {
        return this.activeRequestActionKey === `${action}:${userId}`
      },
      isUserBusy (userId) {
        return this.activeRequestActionKey.endsWith(`:${userId}`)
      },
      async copyOwnCode () {
        if (!this.myUserCode) {
          return
        }

        try {
          if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(this.myUserCode)
          }

          this.$q.notify({
            type: 'positive',
            message: 'Seu código foi copiado.'
          })
        } catch (error) {
          this.$q.notify({
            type: 'warning',
            message: `Seu código é ${this.myUserCode}`
          })
        }
      },
      async submitFriendRequest () {
        this.normalizeFriendCode()

        if (this.friendCode.length !== 10) {
          this.$q.notify({
            type: 'warning',
            message: 'Informe um código com 10 caracteres.'
          })
          return
        }

        this.submittingFriendRequest = true
        const result = await this.sendFriendRequestByCode(this.friendCode)
        this.submittingFriendRequest = false

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível enviar o convite.'
          })
          return
        }

        this.friendCode = ''
        this.$q.notify({
          type: 'positive',
          message: 'Convite enviado com sucesso.'
        })
      },
      async handleIncomingRequest (action, userId) {
        if (!userId) {
          return
        }

        this.activeRequestActionKey = `${action}:${userId}`
        const handler = action === 'accept' ? this.acceptFriendRequest : this.rejectFriendRequest
        const result = await handler(userId)
        this.activeRequestActionKey = ''

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível atualizar o convite.'
          })
          return
        }

        this.$q.notify({
          type: 'positive',
          message: action === 'accept' ? 'Convite aceito. Agora vocês já são amigos.' : 'Convite recusado.'
        })
      },
      async handleOutgoingCancel (userId) {
        if (!userId) {
          return
        }

        this.activeRequestActionKey = `cancel:${userId}`
        const result = await this.cancelFriendRequest(userId)
        this.activeRequestActionKey = ''

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível cancelar o convite.'
          })
          return
        }

        this.$q.notify({
          type: 'positive',
          message: 'Convite cancelado.'
        })
      },
      async handleRemoveFriend (userId) {
        if (!userId) {
          return
        }

        const confirmed = await new Promise(resolve => {
          this.$q.dialog({
            title: 'Desfazer amizade',
            message: 'Essa pessoa vai sair da sua lista de amigos e a conversa deixará de poder ser aberta até um novo convite ser aceito. O histórico atual será preservado para o caso de vocês voltarem a ser amigos depois.',
            cancel: {
              flat: true,
              label: 'Cancelar'
            },
            ok: {
              color: 'negative',
              label: 'Desfazer'
            },
            persistent: true
          })
            .onOk(() => resolve(true))
            .onCancel(() => resolve(false))
            .onDismiss(() => resolve(false))
        })

        if (!confirmed) {
          return
        }

        this.activeRequestActionKey = `remove:${userId}`
        const result = await this.removeFriend(userId)
        this.activeRequestActionKey = ''

        if (!result || !result.ok) {
          this.$q.notify({
            type: 'negative',
            message: result && result.error ? result.error : 'Não foi possível desfazer a amizade.'
          })
          return
        }

        this.$q.notify({
          type: 'positive',
          message: 'Amizade removida. O histórico da conversa foi preservado.'
        })
      }
    }
  }
</script>

<style lang="stylus">
.users-page
  padding-bottom calc(16px + env(safe-area-inset-bottom))

.users-shell
  max-width 920px

.users-hero,
.users-panel,
.users-empty
  border-radius 12px
  background rgba(255, 255, 255, 0.82)
  border 1px solid rgba(7, 94, 84, 0.08)
  box-shadow 0 16px 40px rgba(10, 54, 49, 0.08)

.body--dark .users-hero,
.body--dark .users-panel,
.body--dark .users-empty
  background rgba(17, 22, 26, 0.8)
  border 1px solid rgba(129, 199, 132, 0.08)
  box-shadow 0 20px 44px rgba(0, 0, 0, 0.22)

.users-hero
  position relative
  overflow hidden
  display flex
  justify-content space-between
  align-items flex-start
  gap 14px
  padding 16px 18px
  background linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 251, 248, 0.92) 55%, rgba(231, 244, 238, 0.92) 100%)

  &:before
    content ''
    position absolute
    right -38px
    top -44px
    width 150px
    height 150px
    border-radius 999px
    background radial-gradient(circle, rgba(7, 94, 84, 0.12) 0%, rgba(7, 94, 84, 0) 72%)
    pointer-events none

.users-hero__copy
  position relative
  z-index 1
  max-width 520px

.users-hero__eyebrow,
.users-panel__eyebrow
  font-size 0.72rem
  letter-spacing 0.18em
  text-transform uppercase
  color #075e54
  font-weight 700

.body--dark .users-hero__eyebrow,
.body--dark .users-panel__eyebrow
  color #7ee7d5

.users-hero__title,
.users-panel__title
  margin-top 6px
  font-size 1.05rem
  font-weight 700
  color #16302d

.body--dark .users-hero__title,
.body--dark .users-panel__title
  color #f0f7f5

.users-hero__subtitle
  margin-top 6px
  font-size 0.9rem
  color #5b6c69
  line-height 1.45

.body--dark .users-hero__subtitle
  color #a5b8b3

.users-hero__highlight
  display inline-flex
  align-items center
  gap 6px
  margin-top 10px
  padding 6px 10px
  border-radius 999px
  background rgba(7, 94, 84, 0.08)
  color #1d5550
  font-size 0.8rem
  font-weight 600

.body--dark .users-hero__highlight
  background rgba(126, 231, 213, 0.08)
  color #9de8db

.users-hero__meta
  position relative
  z-index 1
  display flex
  flex-direction column
  align-items flex-end
  gap 6px

.users-hero__badge
  padding 6px 10px
  border-radius 8px

.users-hero__code-wrap
  display flex
  flex-direction column
  align-items flex-end
  gap 4px
  padding 8px 10px
  border-radius 10px
  background rgba(255, 255, 255, 0.54)
  border 1px solid rgba(7, 94, 84, 0.08)

.body--dark .users-hero__code-wrap
  background rgba(255, 255, 255, 0.04)
  border 1px solid rgba(126, 231, 213, 0.08)

.users-hero__code-label
  font-size 0.72rem
  font-weight 700
  color #46625c

.body--dark .users-hero__code-label
  color #a2b5b0

.users-hero__code-chip
  min-height 30px
  padding 0 4px
  font-size 0.82rem
  font-weight 700
  background rgba(7, 94, 84, 0.04)
  letter-spacing 0.03em

.body--dark .users-hero__code-chip
  background rgba(255, 255, 255, 0.05)

.users-panel
  padding 18px 20px

.users-panel--soft
  background rgba(255, 255, 255, 0.72)
  box-shadow 0 10px 26px rgba(10, 54, 49, 0.05)

.body--dark .users-panel--soft
  background rgba(17, 22, 26, 0.74)
  box-shadow 0 14px 28px rgba(0, 0, 0, 0.16)

.users-panel__header
  display flex
  justify-content space-between
  align-items center
  gap 12px
  margin-bottom 10px

.users-panel__title
  font-size 1.02rem

.users-panel__hint
  margin-top 8px
  font-size 0.87rem
  color #667571

.body--dark .users-panel__hint
  color #99a8a4

.users-add-form
  display flex
  gap 10px
  align-items center

.users-add-form__input
  flex 1

.users-add-form__btn
  min-width 148px
  min-height 40px
  border-radius 10px

.users-list
  border-radius 12px
  overflow hidden
  background rgba(255, 255, 255, 0.58)
  border 1px solid rgba(7, 94, 84, 0.08)

.users-list--embedded
  margin-top 4px

.users-panel__body
  padding 0 18px 16px

.body--dark .users-list
  background rgba(10, 16, 18, 0.54)
  border 1px solid rgba(126, 231, 213, 0.08)

.users-panel--collapsible
  padding 0

.request-expansion__header
  min-height 58px
  padding 14px 18px

.request-expansion__title
  margin-top 4px
  font-size 0.96rem
  font-weight 600
  color #24423d

.body--dark .request-expansion__title
  color #d8e7e3

.request-expansion--composer .request-expansion__header
  min-height 56px

.users-list__item
  min-height 82px

.users-list__item--static
  cursor default

.users-list__item--request
  min-height 66px

.users-list__item--unread
  background rgba(7, 94, 84, 0.08)

.body--dark .users-list__item--unread
  background rgba(126, 231, 213, 0.08)

.users-list__item:hover
  background rgba(7, 94, 84, 0.05)

.body--dark .users-list__item:hover
  background rgba(126, 231, 213, 0.06)

.users-list__avatar
  font-weight 700
  box-shadow 0 10px 20px rgba(7, 94, 84, 0.24)

.users-list__avatar--request
  width 34px
  height 34px
  font-size 0.86rem
  box-shadow none

.users-list__name
  font-size 1rem
  font-weight 700

.users-list__email
  margin-top 2px
  color #7b8d89

.body--dark .users-list__email
  color #8da09b

.users-list__side
  gap 8px

.users-list__side--actions
  flex-direction row
  align-items center
  gap 6px

.users-list__action-btn
  min-height 34px
  padding 0 10px
  border-radius 8px

.users-list__action-btn--ghost
  background rgba(7, 94, 84, 0.04)

.body--dark .users-list__action-btn--ghost
  background rgba(255, 255, 255, 0.05)

.users-list__menu-btn
  margin-left 2px

.users-friend-menu
  border-radius 10px

.users-list__status
  padding 6px 10px
  border-radius 8px

.users-list__unread
  min-width 28px
  justify-content center
  border-radius 8px

.users-empty
  margin-top 18px
  min-height 280px
  padding 32px
  text-align center

.users-empty__title
  margin-top 14px
  font-size 1.05rem
  font-weight 700

.users-empty__text
  margin-top 8px
  max-width 420px
  color #6a7c78

.body--dark .users-empty__text
  color #98aaa5

@media (max-width: 700px)
  .users-hero
    flex-direction column
    padding 14px 14px

    &:before
      right -54px
      top -54px
      width 130px
      height 130px

  .users-hero__meta
    width 100%
    align-items flex-start

  .users-hero__code-wrap
    align-items flex-start

  .users-add-form
    flex-direction column
    align-items stretch

  .users-add-form__btn
    width 100%

@media (max-width: 600px)
  .users-hero,
  .users-panel,
  .users-list,
  .users-empty
    border-radius 10px

  .users-hero__title
    font-size 0.98rem

  .users-hero__subtitle
    font-size 0.86rem

  .users-list__item
    min-height 68px

  .users-list__item--request
    min-height 60px

  .users-list__avatar
    width 38px
    height 38px
    font-size 0.92rem
    box-shadow 0 6px 14px rgba(7, 94, 84, 0.18)

  .users-list__name
    font-size 0.94rem

  .users-list__email
    font-size 0.76rem

  .users-list__status,
  .users-list__unread
    transform scale(0.94)

  .users-list__side
    gap 4px

  .users-list__side--actions
    flex-direction column
    align-items stretch
</style>
