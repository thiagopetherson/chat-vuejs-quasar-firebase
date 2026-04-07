<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header elevated class="app-header">
      <q-toolbar class="app-toolbar">
        <div class="header-side header-side--left">
          <q-btn
            v-if="$route.fullPath.includes('/chat')"
            @click="$router.go(-1)"
            icon="arrow_back"
            flat
            round
            class="header-icon-btn"
            aria-label="Voltar"
          />
        </div>

        <q-toolbar-title class="app-toolbar__title">
          <div class="app-toolbar__eyebrow">Realtime chat</div>
          <div class="app-toolbar__headline">{{ title }}</div>
        </q-toolbar-title>

        <div class="header-side header-side--right">
          <q-btn
            v-if="userDetails.userId && notificationsSupported"
            @click="enableNotifications"
            :icon="notificationsIcon"
            flat
            round
            class="header-icon-btn q-mr-xs"
            :title="notificationsTitle"
            aria-label="Ativar notificações"
          />

          <q-btn
            @click="toggleDarkMode"
            :icon="isDarkMode ? 'light_mode' : 'dark_mode'"
            flat
            round
            class="header-icon-btn q-mr-xs"
            :aria-label="isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'"
          />

          <q-btn
            v-if="!userDetails.userId && !$route.fullPath.includes('/auth')"
            to="/auth"
            icon="account_circle"
            no-caps
            flat
            class="header-action-btn"
            label="Login"
          />

          <q-btn
            v-else
            @click="logoutUser"
            icon="logout"
            no-caps
            flat
            class="header-action-btn"
          >
            <span class="header-user-text">{{ userDetails.name }}</span>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container class="app-page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import mixinOtherUserDetails from 'src/mixins/mixin-other-user-details.js'


export default {
  name: 'MainLayout',
  mixins: [mixinOtherUserDetails],
  computed: {
    ...mapState('store', ['userDetails', 'notificationPermission']),
    isDarkMode () {
      return this.$q.dark.isActive
    },
    notificationsSupported () {
      return this.notificationPermission !== 'unsupported'
    },
    notificationsIcon () {
      if (!this.notificationsSupported) {
        return 'notifications_off'
      }

      if (this.notificationPermission === 'granted') {
        return 'notifications_active'
      }

      if (this.notificationPermission === 'denied') {
        return 'notifications_off'
      }

      return 'notifications'
    },
    notificationsTitle () {
      if (!this.notificationsSupported) {
        return 'Notificações não suportadas neste dispositivo'
      }

      if (this.notificationPermission === 'granted') {
        return 'Notificações do navegador ativadas'
      }

      if (this.notificationPermission === 'denied') {
        return 'As notificações foram bloqueadas no navegador'
      }

      return 'Ativar notificações de novas mensagens'
    },
    title () {

      let currentPath = this.$route.fullPath // Pegando a rota atual
      // verificando qual é a rota e retornando o título da página
      if (currentPath == '/') {
        return 'SmartChat'
      } else if (currentPath.includes('/chat')) {
        return this.otherUserDetails.name || 'Conversa'
      } else if (currentPath == '/auth') {
         return 'Login'
      }

      return 'SmartChat'
    }
  },
  created () {
    const savedDarkMode = localStorage.getItem('smartchat-dark-mode')

    if (savedDarkMode !== null) {
      this.$q.dark.set(savedDarkMode === 'true')
      return
    }

    this.$q.dark.set(false)
  },
  methods: {
      ...mapActions('store', ['logoutUser', 'requestNotificationPermission']),
      async enableNotifications () {
        if (this.notificationPermission === 'granted' || this.notificationPermission === 'denied') {
          return
        }

        await this.requestNotificationPermission()
      },
      toggleDarkMode () {
        const nextMode = !this.$q.dark.isActive
        this.$q.dark.set(nextMode)
        localStorage.setItem('smartchat-dark-mode', String(nextMode))
      }
  }
}
</script>

<style lang="stylus">
.app-shell
  background linear-gradient(180deg, rgba(7, 94, 84, 0.08) 0%, rgba(222, 248, 238, 0.88) 35%, rgba(247, 250, 248, 1) 100%)

.body--dark .app-shell
  background linear-gradient(180deg, rgba(6, 32, 29, 1) 0%, rgba(10, 24, 23, 1) 45%, rgba(15, 17, 21, 1) 100%)

.app-header
  backdrop-filter blur(16px)
  background rgba(255, 255, 255, 0.82)
  border-bottom 1px solid rgba(7, 94, 84, 0.12)
  color #16302d

.body--dark .app-header
  background rgba(11, 18, 19, 0.84)
  border-bottom 1px solid rgba(116, 214, 197, 0.12)
  color #f5fbf9

.platform-ios
  .q-header
    .q-btn, .q-toolbar__title
      padding-top constant(safe-area-inset-top)
      padding-top env(safe-area-inset-top)

.app-toolbar
  min-height 72px
  padding 10px 16px

.header-side
  display flex
  align-items center
  min-width 88px

.header-side--right
  justify-content flex-end

.app-toolbar__title
  text-align center
  padding 0 12px

.app-toolbar__eyebrow
  font-size 0.7rem
  letter-spacing 0.18em
  text-transform uppercase
  opacity 0.7

.app-toolbar__headline
  font-size 1.15rem
  font-weight 700
  line-height 1.2

.header-icon-btn,
.header-action-btn
  border-radius 8px
  line-height 1.2

.header-icon-btn
  min-width 44px
  min-height 44px

.header-action-btn
  min-height 44px

.header-action-btn
  padding 8px 12px
  background rgba(7, 94, 84, 0.08)

.body--dark .header-action-btn
  background rgba(255, 255, 255, 0.08)

.header-user-text
  max-width 110px
  overflow hidden
  text-overflow ellipsis
  white-space nowrap

.app-page-container
  padding-top 6px

@media (max-width: 600px)
  .app-toolbar
    padding 8px 10px

  .header-side
    min-width 56px

  .app-toolbar__title
    padding 0 8px

  .app-toolbar__headline
    font-size 1rem
</style>
