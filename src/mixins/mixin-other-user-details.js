export default {
    computed: {
        otherUserDetails () {
            const emptyUser = {
                userId: '',
                name: '',
                email: '',
                online: false
            }

            if (this.$store.state.store.users.length > 0) {
                let user = emptyUser
				this.$store.state.store.users.forEach(item => {
                    if ( item.userId == this.$route.params.otherUserId ) {
                        user = item
                    }
                });

                return user
			}
			return emptyUser
        }
    }
}
