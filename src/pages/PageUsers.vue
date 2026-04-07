<template>
  <q-page class="users-page app-mobile-page q-pa-md">
    <div class="users-shell q-mx-auto">
      <div class="users-hero q-mb-md">
        <div>
          <div class="users-hero__eyebrow">Contatos</div>
          <div class="users-hero__title">Escolha alguém para iniciar uma conversa.</div>
        </div>
        <q-badge class="users-hero__badge" color="primary" text-color="white">
          {{ usersList.length }} {{ usersList.length === 1 ? 'contato' : 'contatos' }}
        </q-badge>
      </div>

      <q-list v-if="usersList.length" class="users-list" separator>
        <q-item v-for="user in usersList" :key="getUserId(user)" :to="'/chat/' + getUserId(user)" clickable v-ripple class="users-list__item" :class="{ 'users-list__item--unread': getUserUnreadCount(user) > 0 }">
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white" class="users-list__avatar">
              {{ getUserName(user).substr(0,1) }}
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
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else class="users-empty column items-center justify-center">
        <q-icon name="forum" size="52px" color="primary" />
        <div class="users-empty__title">Nenhum contato disponível agora.</div>
        <div class="users-empty__text">Assim que outros usuários se cadastrarem, eles aparecerão aqui.</div>
      </div>
    </div>
  </q-page>
</template>

<script>
  export default {
  name: 'PageUsers',
  data () {
    return {

    }
  },
  methods: {
    getUserId (user) {
      return user && user.userId ? user.userId : ''
    },
    getUserName (user) {
      return user && user.name ? user.name : ''
    },
    getUserUnreadCount (user) {
      return user && user.unreadCount ? user.unreadCount : 0
    },
    getUserOnline (user) {
      return Boolean(user && user.online)
    },
    getUserSecondaryText (user) {
      const unreadCount = this.getUserUnreadCount(user)

      if (unreadCount > 0) {
        return `${unreadCount} ${unreadCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
      }

      return user && user.email ? user.email : ''
    }
  },
  computed: {
    usersList () {
      const users = this.$store.getters['store/users']
      const unreadMessages = this.$store.state.store.unreadMessages || {}

      return (Array.isArray(users) ? users : []).map(user => ({
        userId: user && user.userId ? user.userId : '',
        name: user && user.name ? user.name : '',
        email: user && user.email ? user.email : '',
        online: Boolean(user && user.online),
        unreadCount: unreadMessages[user && user.userId ? user.userId : ''] || 0
      })).sort((firstUser, secondUser) => {
        if (firstUser.unreadCount !== secondUser.unreadCount) {
          return secondUser.unreadCount - firstUser.unreadCount
        }

        return firstUser.name.localeCompare(secondUser.name)
      })
    }
  },
  mounted() {
    // console.log(this.usersList)
  }
}

</script>

<style lang="stylus">
.users-page
  padding-bottom calc(16px + env(safe-area-inset-bottom))

.users-shell
  max-width 920px

.users-hero
  display flex
  justify-content space-between
  align-items center
  gap 12px
  padding 18px 22px
  border-radius 12px
  background rgba(255, 255, 255, 0.76)
  border 1px solid rgba(7, 94, 84, 0.08)
  box-shadow 0 16px 40px rgba(10, 54, 49, 0.08)

.body--dark .users-hero
  background rgba(17, 22, 26, 0.78)
  border 1px solid rgba(129, 199, 132, 0.08)
  box-shadow 0 20px 44px rgba(0, 0, 0, 0.22)

.users-hero__eyebrow
  font-size 0.72rem
  letter-spacing 0.18em
  text-transform uppercase
  color #075e54
  font-weight 700

.body--dark .users-hero__eyebrow
  color #7ee7d5

.users-hero__title
  margin-top 6px
  font-size 1.3rem
  font-weight 700
  color #16302d

.body--dark .users-hero__title
  color #f0f7f5

.users-hero__badge
  padding 8px 12px
  border-radius 8px

.users-list
  margin-top 18px
  border-radius 12px
  overflow hidden
  background rgba(255, 255, 255, 0.82)
  border 1px solid rgba(7, 94, 84, 0.08)
  box-shadow 0 16px 40px rgba(10, 54, 49, 0.08)

.body--dark .users-list
  background rgba(17, 22, 26, 0.8)
  border 1px solid rgba(129, 199, 132, 0.08)
  box-shadow 0 20px 44px rgba(0, 0, 0, 0.22)

.users-list__item
  min-height 82px

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

.users-list__name
  font-size 1rem
  font-weight 700

.users-list__email
  margin-top 2px
  color #7b8d89

.body--dark .users-list__email
  color #8da09b

.users-list__status
  padding 6px 10px
  border-radius 8px

.users-list__side
  gap 8px

.users-list__unread
  min-width 28px
  justify-content center
  border-radius 8px

.users-empty
  margin-top 18px
  min-height 280px
  border-radius 12px
  padding 32px
  text-align center
  background rgba(255, 255, 255, 0.82)
  border 1px dashed rgba(7, 94, 84, 0.16)

.body--dark .users-empty
  background rgba(17, 22, 26, 0.8)
  border 1px dashed rgba(126, 231, 213, 0.18)

.users-empty__title
  margin-top 14px
  font-size 1.05rem
  font-weight 700

.users-empty__text
  margin-top 8px
  max-width 380px
  color #6a7c78

.body--dark .users-empty__text
  color #98aaa5

@media (max-width: 600px)
  .users-hero
    flex-direction column
    align-items flex-start

  .users-list,
  .users-empty
    border-radius 10px
</style>
