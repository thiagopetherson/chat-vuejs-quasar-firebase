<template>
  <router-view />
</template>
<script>
import { mapActions } from 'vuex';

export default {
 methods: {
   ...mapActions('store', ['handleAuthStateChanged'])
 },
 mounted () {
   // Chamando método que muda o status do usuário (seta os dados do usuário logado no estado)
   this.handleAuthStateChanged()
 }
}
</script>
