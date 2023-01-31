
const { createApp } = Vue

createApp({
  data() {
    return {
      message: 'Only a test',
      info: null,
      url: atob("aHR0cHM6Ly9pbnZlbnRvcnlzZXJ2aWNlcy5ibXdkZWFsZXJwcm9ncmFtcy5jb20v"),
      token: ""
    }
  },
  methods: {
    getToken() {
      let tokenUrl = this.url + "token"
      let username = atob("Qk1XSW52ZW50b3J5QGNyaXRpY2FsbWFzcy5jb20=")
      let password = atob("MW52M250MHJ5ITIwMjA=")
      let payload = {
        "grant_type": "password",
        "username": username,
        "password": password
      }
      let headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      }
      return axios
        .post(tokenUrl, payload, {
          headers: headers
        })
        .then(response => {
          // console.log(JSON.stringify(response, null, 4))
          this.token = response.data.access_token
          console.log(this.token)
        })
    },
    getInventory(page) {
      // Use radius 0 for nationwide
      let auth = "Bearer " + this.token
      let payload = {
        "pageIndex": page,
        "PageSize":100,
        "postalCode":"55115",
        "radius":0,
        "sortBy":"price",
        "sortDirection":"asc",
        "formatResponse":false,
        "includeFacets":true,
        "includeDealers":true,
        "includeVehicles":true,
        "filters":[
          {"name":"Series","values":["3 Series"]},{"name":"Year","values":["2019","2020","2021","2022"]},
          {"name":"Option","values":[]},{name: "Model", values: ["330i xDrive"]}
        ]
      }
      let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": auth
      }
      let url = URL + "vehicle"
      let inventoryUrl = this.url + "vehicle"
      axios
        .post(inventoryUrl, payload, {
            headers: headers
        })
        .then(response => {
          console.log(JSON.stringify(response, null, 4))
          // this.token = response.data.access_token
          // console.log(this.token)
        })
    }
  },
  mounted() {
    this.getToken()
      .then( () => {
        this.getInventory(0)
      })
  }
}).mount("#app")