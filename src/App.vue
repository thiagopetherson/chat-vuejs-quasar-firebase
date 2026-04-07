<template>
  <router-view />
</template>
<script>
import { mapActions, mapGetters } from 'vuex';

export default {
 computed: {
   ...mapGetters('store', ['unreadTotal'])
 },
 methods: {
   ...mapActions('store', ['handleAuthStateChanged', 'setAppVisibility', 'syncNotificationPermission']),
   handleVisibilityChange () {
     const isVisible = document.visibilityState !== 'hidden'
     this.setAppVisibility(isVisible)
     this.updateDocumentTitle()
   },
   handleWindowFocus () {
     this.setAppVisibility(true)
     this.updateDocumentTitle()
   },
   handleWindowBlur () {
     if (document.visibilityState === 'hidden') {
       this.setAppVisibility(false)
     }
   },
   updateDocumentTitle () {
     const defaultTitle = 'SmartChat'
     document.title = this.unreadTotal > 0 ? `(${this.unreadTotal}) ${defaultTitle}` : defaultTitle
   }
 },
 mounted () {
   // Chamando método que muda o status do usuário (seta os dados do usuário logado no estado)
   this.handleAuthStateChanged()
   this.syncNotificationPermission()
   this.setAppVisibility(document.visibilityState !== 'hidden')
   document.addEventListener('visibilitychange', this.handleVisibilityChange)
   window.addEventListener('focus', this.handleWindowFocus)
   window.addEventListener('blur', this.handleWindowBlur)
   this.updateDocumentTitle()
 },
 beforeUnmount () {
   document.removeEventListener('visibilitychange', this.handleVisibilityChange)
   window.removeEventListener('focus', this.handleWindowFocus)
   window.removeEventListener('blur', this.handleWindowBlur)
 },
 watch: {
   unreadTotal () {
     this.updateDocumentTitle()
   }
 }
}
</script>
