<template>
  <q-page class="flex q-pa-md">
    <q-card class="full-width">
        <q-tabs
          v-model="tab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="login" label="Login" />
          <q-tab name="register" label="Registro" />         
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="tab" animated>
          <q-tab-panel name="login">
             <LoginRegister :tab="tab" />
          </q-tab-panel>

          <q-tab-panel name="register">
            <LoginRegister :tab="tab" />
          </q-tab-panel>
        </q-tab-panels>
    </q-card> 
  </q-page>
</template>

<script>

export default {
  name: 'PageAuth',
  components: {
    'LoginRegister':  require('components/LoginRegister.vue').default
  },
  data () {
    return {
      tab: 'login'
    }
  }
}

</script>

<style>

</style>
