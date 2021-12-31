<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>        
        
        <q-btn class="absolute-left" v-if="$route.fullPath.includes('/chat')" @click="$router.go(-1)" icon="arrow_back" flat dense label="Voltar" />

        <q-toolbar-title class="absolute-center">
         {{ title }}
        </q-toolbar-title>

        <q-btn v-if="!userDetails.userId" to="/auth" class="absolute-right q-pr-sm" icon="account_circle" no-caps flat dense label="Login" />
        <q-btn v-else @click="logoutUser" class="absolute-right q-pr-sm" icon="account_circle" no-caps flat dense>Logout<br>{{ userDetails.name }}</q-btn>
        
      </q-toolbar>
    </q-header>   

    <q-page-container>
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
    ...mapState('store', ['userDetails']),
    title () {
     
      let currentPath = this.$route.fullPath // Pegando a rota atual    
      // verificando qual é a rota e retornando o título da página
      if (currentPath == '/') {
        return 'SmackChat'
      } else if (currentPath.includes('/chat')) {
        return this.otherUserDetails.name
      } else if (currentPath == '/auth') {
         return 'Login'
      }

    }
  },
  methods: {
      ...mapActions('store', ['logoutUser'])
  } 
}
</script>

<style lang="stylus">
  .platform-ios
    .q-header
      .q-btn, .q-toolbar__title
        padding-top constant(safe-area-inset-top)
        padding-top env(safe-area-inset-top)

  .q-toolbar
    .q-btn
      line-height: 1.2
</style>
