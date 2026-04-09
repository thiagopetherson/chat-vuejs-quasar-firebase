<template>
        <q-form class="auth-form" @submit.prevent="submitForm">
                <q-input
                    v-if="tab == 'register'"
                    type="text"
                    class="q-mb-md"
                    outlined
                    v-model="formData.name"
                    label="Nome"
                    autocomplete="name"
                    autocapitalize="words"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                />
                <q-input
                    v-if="tab == 'register'"
                    type="password"
                    class="q-mb-md"
                    outlined
                    v-model="formData.token"
                    label="Token de acesso"
                    autocomplete="one-time-code"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                />
                <q-input
                    type="email"
                    class="q-mb-md"
                    outlined
                    v-model="formData.email"
                    label="Email"
                    autocomplete="email"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    inputmode="email"
                    :dark="$q.dark.isActive"
                    :bg-color="$q.dark.isActive ? 'dark-page' : 'white'"
                />
                <q-input
                    type="password"
                    class="q-mb-md"
                    outlined
                    v-model="formData.password"
                    label="Senha"
                    :autocomplete="tab == 'login' ? 'current-password' : 'new-password'"
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
                                :loading="submitting"
                                :disable="submitting"
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
            submitting: false,
            formData: {
        name: '',
        token: '',
        email: '',
        password: ''
            }
    }
    },
    methods: {
    ...mapActions('store', ['registerUser', 'loginUser']),
    async submitForm () {
            if (!this.formData.email || !this.formData.password || (this.tab == 'register' && (!this.formData.name || !this.formData.token))) {
                this.$q.notify({
                    type: 'warning',
                    message: 'Preencha os campos obrigatórios antes de continuar.'
                })
                return
            }

            this.submitting = true

            const payload = {
                name: this.formData.name,
                token: this.formData.token,
                email: this.formData.email,
                password: this.formData.password
            }

            let result

            if (this.tab == 'login') {
                result = await this.loginUser(payload)
            } else if (this.tab == 'register') {
                result = await this.registerUser(payload)
            }

            this.submitting = false

            if (!result || !result.ok) {
                this.$q.notify({
                    type: 'negative',
                    message: result && result.error ? result.error : 'Não foi possível concluir a operação.'
                })
                return
            }

            if (this.tab == 'register') {
                this.$q.notify({
                    type: 'positive',
                    message: 'Conta criada com sucesso. Você já pode conversar.'
                })
                this.formData.name = ''
                this.formData.token = ''
            }

            this.formData.email = ''
            this.formData.password = ''
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
    min-width 168px
    min-height 46px
    border-radius 8px
    padding 10px 18px
    font-weight 700
</style>
