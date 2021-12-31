export default {
    computed: {
        otherUserDetails () {
            
            if (this.$store.state.store.users.length > 0) {
                let user = ''
				this.$store.state.store.users.forEach(item => {                    
                    if ( item.userId == this.$route.params.otherUserId ) {
                        user = item
                    }
                });

                return user
			}
			return []
        }
    }
}