<template>
  <q-page class="auth-page app-mobile-page flex flex-center q-pa-md">
    <div class="auth-page__glow auth-page__glow--one"></div>
    <div class="auth-page__glow auth-page__glow--two"></div>

    <q-card class="auth-card full-width">
      <q-card-section class="auth-card__hero">
        <div class="auth-card__eyebrow">SmartChat</div>
        <div class="auth-card__title">O chat oficial da panelinha do Thiago para trocar ideia em tempo real.</div>
        <div class="auth-card__subtitle">Entre na sua conta ou crie um perfil para iniciar as conversas.</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-tabs
          v-model="tab"
          dense
          class="auth-tabs"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="login" label="Login" />
          <q-tab name="register" label="Registro" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="tab" animated class="auth-panels" keep-alive>
          <q-tab-panel name="login" class="auth-panel">
             <LoginRegister :tab="tab" />
          </q-tab-panel>

          <q-tab-panel name="register" class="auth-panel">
            <LoginRegister :tab="tab" />
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
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

<style lang="stylus">
.auth-page
  position relative
  overflow hidden

.auth-card
  position relative
  z-index 1
  max-width 520px
  border-radius 12px
  background rgba(255, 255, 255, 0.88)
  box-shadow 0 24px 60px rgba(10, 54, 49, 0.16)
  border 1px solid rgba(7, 94, 84, 0.08)

.body--dark .auth-card
  background rgba(17, 22, 26, 0.88)
  box-shadow 0 28px 70px rgba(0, 0, 0, 0.36)
  border 1px solid rgba(129, 199, 132, 0.12)

.auth-card__hero
  padding 28px 28px 20px

.auth-card__eyebrow
  margin-bottom 8px
  font-size 0.76rem
  letter-spacing 0.2em
  text-transform uppercase
  color #075e54
  font-weight 700

.body--dark .auth-card__eyebrow
  color #7ee7d5

.auth-card__title
  font-size 1.7rem
  line-height 1.2
  font-weight 800
  color #183633

.body--dark .auth-card__title
  color #f1f7f6

.auth-card__subtitle
  margin-top 10px
  color #5b6c69
  line-height 1.6

.body--dark .auth-card__subtitle
  color #a5b8b3

.auth-tabs
  color #6a7c78

.auth-panels
  background transparent

.auth-panel
  padding 24px 0 0

.auth-page__glow
  position absolute
  border-radius 999px
  filter blur(10px)
  opacity 0.55

.auth-page__glow--one
  width 320px
  height 320px
  top 30px
  left -90px
  background radial-gradient(circle, rgba(7, 94, 84, 0.22) 0%, rgba(7, 94, 84, 0) 70%)

.auth-page__glow--two
  width 260px
  height 260px
  right -50px
  bottom 20px
  background radial-gradient(circle, rgba(129, 199, 132, 0.22) 0%, rgba(129, 199, 132, 0) 70%)

@media (max-width: 600px)
  .auth-card
    border-radius 10px

  .auth-card__hero
    padding 24px 22px 18px

  .auth-card__title
    font-size 1.45rem
</style>
