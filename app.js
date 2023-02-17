
const { createApp } = Vue

const app = createApp({
  data() {
    return {
      request: {
        url: atob("aHR0cHM6Ly9pbnZlbnRvcnlzZXJ2aWNlcy5ibXdkZWFsZXJwcm9ncmFtcy5jb20v"),
        imageUrl: atob("aHR0cHM6Ly9ibXctaW52ZW50b3J5LWFzc2V0cy1wcm9kLmF6dXJlZWRnZS5uZXQvaW1hZ2VzLw=="),
        carFaxUrl: atob("aHR0cHM6Ly93d3cuY2FyZmF4LmNvbS9WZWhpY2xlSGlzdG9yeS9wL1JlcG9ydC5jZng/cGFydG5lcj1TRFRfMCZ2aW49"),
        bmwUrl: atob("aHR0cHM6Ly93d3cuYm13dXNhLmNvbS9jZXJ0aWZpZWQtcHJlb3duZWQtc2VhcmNoLyMvZGV0YWlsLw=="),
        token: ""
      },
      inventory: {
        filtered: [],
        all: [],
        count: null
      },
      dealers: {
        current: {},
        new: {}
      },
      loading: false,
      filtering: {
        radius: "25", // Use radius 0 for nationwide
        zip: "55305",
        options: "",
        filters: {}, // Filters to show user and holds the enabled/disabled value of each filter
        filtersToSearch: [], // List of user set filters to send with the inventory request
        sortOptions: ["Distance", "Price", "Odometer", "Year"],
        sortBy: "Price",
        show: screen.width > 768 // Default hide filters on mobile
      },
      search: {
        pageIndex: 0,
        numberOfPages: 1,
        pageSize: 25,
        pages: [],
        facets: {},
        facetNames: [],
        facetMap: {
          "Odometer": "Odometer",
          "Price": "Price",
          "Year": "Year",
          "Series": "Series",
          "Model": "Model",
          "Option": "Package",
          "ExteriorColor": "Exterior Color",
          "InteriorColor": "Interior Color",
          "Upholstery": "Upholstery",
          "Drivetrain": "Drivetrain",
          "Transmission": "Transmission",
          "BodyStyle": "Body Style",
          "FuelType": "Fuel Type"
        },
        facetOrder: ["Odometer", "Price", "Year", "Series", "Model", "Option", "ExteriorColor", "InteriorColor", "Upholstery", "Drivetrain", "Transmission", "BodyStyle", "FuelType"]
      },
      formatter: new Intl.NumberFormat()
    }
  },
  methods: {
    getToken() {
      let tokenUrl = this.request.url + "token"
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
      console.log("Fetching", tokenUrl)
      return axios
        .post(tokenUrl, payload, {
          headers: headers
        })
        .then(response => {
          // console.log(JSON.stringify(response, null, 4))
          this.request.token = response.data.access_token
          console.log(this.token)
        })
    },
    getInventory(resultsIndex) {
      // Get a page of inventory results
      console.log("Results index", resultsIndex)
      // Return if no token is set
      if(this.request.token.length < 10) {
        console.log("No token")
        return Promise.resolve()
      }
      // Set up the body of the request including all filters
      let auth = "Bearer " + this.request.token
      let payload = {
        "pageIndex": resultsIndex,
        "PageSize": this.search.pageSize,
        "postalCode": this.filtering.zip,
        "radius": this.filtering.radius,
        "sortBy": this.filtering.sortBy,
        "sortDirection": "asc",
        "formatResponse": false,
        "includeFacets": true,
        "includeDealers": true,
        "includeVehicles": true,
        "filters": this.filtering.filtersToSearch
      }
      let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": auth // Use the token we fetched earlier
      }
      let url = URL + "vehicle"
      let inventoryUrl = this.request.url + "vehicle"
      console.log("Fetching", inventoryUrl)
      return axios
        .post(inventoryUrl, payload, {
            headers: headers
        })
        .then(response => {
          // Once the response has been recieved, process the inventory results
          // However, nothing will be processed or updated on the UI until all pages of results are recieved
          this.processInventory(response.data)
          // If we are filtering by option codes and there are more than one page of results, then recursively grab the next page
          let numberOfPages = this.search.numberOfPages
          if(this.filteringByOption && !isNaN(numberOfPages) && numberOfPages > 1 && this.search.pageIndex < numberOfPages) {
            this.getInventory(this.search.pageIndex * this.search.pageSize)
          } else {
            console.log("All results have been fetched")
            console.log("Retrieved", this.inventory.all.length, "vehicles")
            // Now that all the results have been recived we can process/filter everything
            this.filterAllInventory()
            this.setLoading(false);
          }
        })
    },
    processInventory(inventory) {
      // Save all inventory results before filtering
      this.inventory.all = this.inventory.all.concat(inventory.vehicles)
      // Store dealer information so vehicles can reference their associated dealer
      inventory.dealers.forEach( dealer => {
        // Each vehicle includes a dealer code
        this.dealers.new[dealer.dealerCode] = dealer
      });
      // If this is the first inventory request then clear out all the old
      // set variables and intialize them so they can be populated with the
      // latest incoming data from one or more inventory responses
      if (this.search.pageIndex == 0) {
        let totalRecords = inventory.totalRecords
        console.log("Total records", totalRecords)
        // Calculate the number of pages required to fetch all inventory for the set filters
        this.search.numberOfPages = Math.ceil(totalRecords / this.search.pageSize)
        // If filters are too broad and require more than 20 pages of results then cap
        // the number of pages to 20
        if(this.search.numberOfPages > 20) {
          this.search.numberOfPages = 20
        }
        console.log("Number of pages", this.search.numberOfPages)
        // print("Recieved %d records for page %d" % (result_records, page_index + 1))
        // Update the user selctable avalible filters values with any new filter types
        this.updateFilters(inventory.facets)
        // Update the filters that are now avaliable, either more or less narrow
        this.updateFacets(inventory.facets)
        // When not filtering by option code, set the inventory length to the total number of results
        if(!this.filteringByOption) {
          this.inventory.count = totalRecords
        }
      }
      this.search.pageIndex += 1
    },
    fetchInventory() {
      // Fetches all the inventory results for either a paticular page or many pages when
      // filtering by option code
      this.setLoading(true);
      this.search.pageIndex = 0 // Reset back to zero
      // If filtering by option code then fetch max page size
      if(this.filteringByOption) {
        this.search.pageSize = 100
      }
      // Clear out the inventory
      this.inventory.all = []
      // Set the array of filters to search on
      this.setFiltersToSerach()
      // Ensure token is set
      let promise = NaN
      if(this.request.token.length < 10) {
        console.log("Grabbing token")
        promise = this.getToken()
      } else {
        promise = Promise.resolve()
      }
      // Fetch inventory starting with first page
      // This call will recursively fetch all inventory results when filtering by option code
      promise.then(() => {
        this.getInventory(0)
      });
    },
    changePage(page) {
      // console.log(page);
      this.search.pageIndex = page - 1;
      this.setLoading(true);
      this.inventory.all = []
      this.getInventory(this.search.pageIndex * this.search.pageSize)
    },
    filterAllInventory() {
      // Once all the inventory has been recieved from one or more pages, filter down the results is necessary 
      this.search.pageSize = 25
      console.log("Filtering inventory")
      console.log("Options", this.filtering.options)
      // If filtering with option codes
      if(this.filteringByOption) {
        // Go through each vehicle and filter out the vehicles that don't have all the option codes
        let options = this.filtering.options.split(", ")
        this.inventory.filtered = this.inventory.all.filter(vehicle => {
          include = true;
          options.forEach(option => {
            if(!vehicle.allCodes || !vehicle.allCodes.includes(option)) {
              include = false
            }
          })
          return include
        })
        // When filtering by option code, set the inventory length to number of filtered down results
        this.inventory.count = this.inventory.filtered.length
      } else {
        // When not filtering by option code, set the filtered inventory equal to the entire inventory
        this.inventory.filtered = this.inventory.all
      }
      console.log("Filtered down to", this.inventory.filtered.length, "vehicles")
      // Clear out previous dealers object and set to updated object
      this.dealers.current = {...this.dealers.new}
      this.dealers.new = {}
      this.setPages()
    },
    vehicleImage(vehicle) {
      // Return the vehicle iamge URL for a vehicle object
      if(!vehicle.photos || vehicle.photos.length == 0) {
        return ""
      }
      return this.request.imageUrl + vehicle.photos[0]
    },
    formatNumber(number) {
      // Adds commas where needed in numbers, i.e. 30000 = 30,000
      return this.formatter.format(number)
    },
    // resultsTooltip() {
    //   return 'Filtered ' + this.inventory.all.length + ' down to ' + this.inventory.filtered.length
    // },
    updateFilters(newFilters) {
      // Update the avaliable filters with the new filter received from the results
      const currentFilters = {...this.filtering.filters}
      // this.filtering.filters = {}
      newFilters.forEach(filter => {
        if(filter.name in currentFilters) {
          // this.filtering.filters[facet.name] = currentFilters[facet.name]
        } else {
          this.filtering.filters[filter.name] = []
        }
      })
      // console.log(this.filtering.filters)
    },
    setFiltersToSerach() {
      // Take all the set filters and create an array of those filters that can be
      // passed along with the inventory request to filter down results
      this.filtering.filtersToSearch = []
      for (const [key, value] of Object.entries(this.filtering.filters)) {
        if(value.length > 0) {
          const filterObject = {name: key, values: value} // Format each filter should be in
          this.filtering.filtersToSearch.push(filterObject)
        }
      }
      console.log("Filtered array", ...this.filtering.filtersToSearch)
    },
    facetName(facetName) {
      // Convert facet name to formatted name
      if(facetName in this.search.facetMap) {
        return this.search.facetMap[facetName]
      }
      return false
    },
    updateFacets(facets) {
      // Iterate over all avaliable facets filter out the ones we don't want to use or any with no values
      // Also, if any of the facets that we filtered on our now unavaliable, add them back in manually
      facetObjects = {}
      this.search.facetNames = []
      facets.forEach(facet => {
        // Don't show the facets we don't want and validate facet values
        if(this.search.facetOrder.indexOf(facet.name) >= 0 && (facet.values.length > 0 || this.filtering.filters[facet.name].length > 0)) {
          array = []
          facet.values.forEach(valueObject => {
            array.push(valueObject.value)
          })
          // Add back in any facets that we filtered on that are now gone
          if(facet.name in this.filtering.filters) {
            array = array.concat(this.filtering.filters[facet.name])
          }
          // Make facet values unqiue after we've merged our filters into the facet array
          facetObjects[facet.name] = [...new Set(array)]
          facetObjects[facet.name].show = this.search.facets[facet.name]?.show
          // Array of facets that the UI renders based on
          this.search.facetNames.push(facet.name)
        }
      })
      // console.log([...this.search.facetNames])
      // Sort the list of facets by the order we've described
      this.search.facetNames.sort((a,b) => {
        return this.search.facetOrder.indexOf(a) > this.search.facetOrder.indexOf(b) ? 1 : -1
      })
      // console.log([...this.search.facetNames])
      // Finally, set the facets to updated object to render in the body of the facets on the UI
      this.search.facets = facetObjects
      this.search.facets["Type"] = ["CPO", "Used"] // Always have 'type' facet avaliable
    },
    setLoading(isLoading) {
      // While fetching the inventory results, show loading spinner
      this.loading = isLoading
    },
    setPages() {
      // [1,2,3,4,5],6,7,8,9
      // 1,2,[3,4,5,6,7],8,9
      // 1,2,3,4,[5,6,7,8,9]

      let numberOfPages = this.search.numberOfPages // 10
      let pageIndex = this.search.pageIndex // 9
      console.log("numberOfPages", numberOfPages);
      console.log("pageIndex", pageIndex);
      pages = []

      endDiff = numberOfPages - pageIndex
      endDiff = 2 - endDiff;
      if(endDiff < 0) {
        endDiff = 0;
      }

      // 2,3, 4, 5,6
      for(let i = pageIndex - 2 - endDiff; i <= numberOfPages; i++) {
        if(i > 0) {
          pages.push(i);
        }
        if(pages.length == 5) {
          break;
        }
      }
      console.log("Pages", [...pages])
      this.search.pages = pages;
    },
    test() {
      this.filtering.zip = 55115;
      this.filtering.radius = 50;
      // this.filtering.options = "5AU";
      // this.fetchInventory();
    }
  },
  computed: {
    showAdditionalPage() {
      return this.search.pages[this.search.pages.length - 1] != this.search.numberOfPages
    },
    filteringByOption() {
      return this.filtering.options.length > 0;
    }
  },
  watch: {
    // allInventory(oldInventory, newInventory) {
      
    // }
  },
  mounted() {
    // Run this when app starts
    // ============================
    // First get the token to be used for fetching inventory
    //  - If this fails, we'll grab the token during the inventory fetching
    // Then fetch first page of inventory with default filters
    this.getToken()
      .then( () => {
        this.fetchInventory()
        // this.test()
      })
  }
}).mount("#app")

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

