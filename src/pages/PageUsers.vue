<template>
  <q-page class="flex q-pa-md">
    <q-list class="full-width" separator>
      <q-item v-for="user in users" :key="user.userId" :to="'/chat/' + user.userId" clickable v-ripple>
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white">
            {{ user.name.substr(0,1) }}
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ user.name }}</q-item-label>          
        </q-item-section>

        <q-item-section side>
          <q-badge :color="user.online ? 'light-green-5' : 'grey-4'">
            {{ user.online ? 'Online' : 'Offline' }}
          </q-badge>
        </q-item-section>
      </q-item>    
    
    </q-list> 
  </q-page>
</template>

<script>
  import { mapGetters } from 'vuex'

  export default {
  name: 'PageUsers',
  data () {
    return {
     
    }
  },
  computed: {
    ...mapGetters('store', ['users'])
  },
  mounted() {
    // console.log(this.users)
  }
}

</script>

<style>

</style>
