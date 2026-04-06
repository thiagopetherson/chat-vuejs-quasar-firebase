<template>
        <q-form class="auth-form" @submit.prevent="submitForm">
                <q-input
                    v-if="tab == 'register'"
                    type="text"
                    class="q-mb-md"
                    outlined
                    rounded
                    v-model="formData.name"
                    label="Nome"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                />
                <q-input
                    type="email"
                    class="q-mb-md"
                    outlined
                    rounded
                    v-model="formData.email"
                    label="Email"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                />
                <q-input
                    type="password"
                    class="q-mb-md"
                    outlined
                    rounded
                    v-model="formData.password"
                    label="Senha"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                    @keyup.enter="submitForm"
                />

                <div class="auth-form__actions row items-center q-col-gutter-sm">
                        <div class="col-12 col-sm">
                            <div class="auth-form__hint">
                                {{ tab == 'login' ? 'Use seu email cadastrado para continuar.' : 'Crie um perfil para aparecer na lista de contatos.' }}
                            </div>
                        </div>
                        <div class="col-12 col-sm-auto">
                            <q-btn
                                color="primary"
                                no-caps
                                unelevated
                                class="auth-form__submit full-width"
                                :label="tab == 'login' ? 'Entrar' : 'Criar conta'"
                                type="submit"
                            />
                        </div>
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
        if (!this.formData.email || !this.formData.password || (this.tab == 'register' && !this.formData.name)) {
            return
        }

        if (this.tab == 'login') {
            this.loginUser(this.formData)
        } else if (this.tab == 'register') {
            this.registerUser(this.formData)
        }
    }
}
}

</script>

<style lang="stylus">
.auth-form__actions
    margin-top 8px

.auth-form__hint
    color #6b7a77
    font-size 0.92rem
    line-height 1.5

.body--dark .auth-form__hint
    color #9eb1ac

.auth-form__submit
    min-width 154px
    border-radius 999px
    padding 10px 18px
    font-weight 700
</style>
