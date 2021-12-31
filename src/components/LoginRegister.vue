<template>
    <q-form>
        <q-input v-if="tab == 'register'" type="text" class="q-mb-md" outlined v-model="formData.name" label="Nome" />
        <q-input type="email" class="q-mb-md" outlined v-model="formData.email" label="Email" />
        <q-input type="password" class="q-mb-md" outlined v-model="formData.password" label="Senha" />
        <div class="row">
            <q-space />
            <q-btn color="primary" :label="tab" @click="submitForm" />
        </div>
    </q-form>
</template>

<script>
import { mapActions } from 'vuex'

export default {
name: 'LoginRegister',
props: ['tab'],
data () {
    return {
    formData: {
        name: '',
        email: '',
        password: ''
    }
    }
},
methods: {
    ...mapActions('store', ['registerUser', 'loginUser']),
    submitForm () {
        if (this.tab == 'login') {
            this.loginUser(this.formData)
        } else if (this.tab == 'register') { 
            this.registerUser(this.formData)
        }
    }
} 
}

</script>

<style>

</style>
