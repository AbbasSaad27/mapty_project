'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sorter = document.querySelector(`.sorter`);
const allDeleteBtn = document.querySelector(`.delete-all`);
const errorPopup = document.querySelector(`.error-popup`);
const overlay = document.querySelector(`.overlay`);
const popupCloser = document.querySelector(`.error-closer`);
const mapPanner = document.querySelector(`.show-all-btn`);
const markerInput = document.querySelector(`.marker__input`);

class Workout {
    date = new Date();
    id = (Date.now() + ``).slice(-10);
    clicks = 0;
    constructor(coords, distance, duration) {
        this.coords = coords; // [lat, lng]
        this.distance = distance; // in km
        this.duration = duration; // in min
        
    }

    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }
    click() {
        this.clicks++;
    }
}

class Running extends Workout {
    type = `running`;
    
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        // min/km
        this.pace = this.duration / this.distance;
        return this.pace;
    }
}
class Cycling extends Workout {
    type = `cycling`;

    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        // km/h
        this.speed = this.distance / this.duration / 60;
    }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycle1 = new Cycling([39, -12], 27, 95, 535);
// console.log(run1, cycle1);

/////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
    #map;
    #mapZoomLevel = 13;
    #mapEvent;
    #workouts = [];
    #markers = [];
    #markerType = `default`;

    constructor(){
        // get user's position
        this._getPosition();
        
        // get data from local storage
        this._getLocalStorage()

        // attach event handlers
        form.addEventListener(`submit`, this._newWorkout.bind(this));

        inputType.addEventListener(`change`, this._toggleElevationField);
        containerWorkouts.addEventListener(`click`, this._moveToPopup.bind(this))
        sorter.addEventListener(`click`, this._sortWorkout.bind(this));
        allDeleteBtn.addEventListener(`click`, this._deleteALlWorkout.bind(this))
        popupCloser.addEventListener(`click`, this._togglePopup);
        mapPanner.addEventListener(`click`, this._panMap.bind(this));
        markerInput.addEventListener(`change`, this._selectMarker.bind(this))
        markerInput.addEventListener(`click`, (e)=>e.stopPropagation());
    }

    _getPosition() {
        if(navigator.geolocation){
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), 
                function(){
                alert(`Could not get your position`);
            });
        };
    }

    _loadMap(position) {
            const {latitude} = position.coords;
            const {longitude} = position.coords;
            console.log(`https://www.google.com/maps/@${latitude},${longitude}`);
    
            const coords = [latitude, longitude];
    
            this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
            // console.log(map);
    
            L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.#map);
    
    
            // on method is addeventlistner of leaflet basically
            // handling clicks on map
            this.#map.on(`click`, this._showForm.bind(this))
            
            this.#workouts.forEach(work => {
                this._renderWorkoutMarker(work);
            });
    }

    _showForm(mapE) {
        this.#mapEvent = mapE;
        form.classList.remove(`hidden`);
        inputDistance.focus();
    }

    _hideForm() {
        // Empty inputs
        this._emptyInputs()

        form.style.display = `none`;
        form.classList.add(`hidden`);
        setTimeout(() => form.style.display = `grid`, 1000);
    }

    _toggleElevationField(e) {
        inputElevation.closest(`.form__row`).classList.toggle(`form__row--hidden`)
    
        inputCadence.closest(`.form__row`).classList.toggle(`form__row--hidden`)
    }

    _newWorkout(e) {
        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0)

        e.preventDefault();

        // Get data from form
        const type = inputType.value;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;
        const {lat, lng} = this.#mapEvent.latlng;
        const coords = [lat, lng];
        let workout;

        // Check if data is valid

        // If workout running, create running object
        if(type === `running`) {
            const cadence = +inputCadence.value;
            // check if data is valid
            if(
            // !Number.isFinite(distance) || !Number.isFinite(duration) ||!Number.isFinite(cadence)
            !validInputs(distance, duration, cadence) ||
            !allPositive(distance, duration, cadence)
            ) {
                this._emptyInputs()
                this._togglePopup();
                return;
            };

            workout = new Running(coords, distance, duration, cadence);
        }

        // If workout cycling, create cycling object
        if(type === `cycling`) {
            const elevation = +inputElevation.value;
            if(!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) {
                this._emptyInputs();
                this._togglePopup();
                return;
            }
            
            workout = new Cycling(coords, distance, duration, elevation);
            
        }

        // Add new object to workout array
        this.#workouts.push(workout);
        // console.log(workout);
        
        // Render workout on map as marker
        this._renderWorkoutMarker(workout);

        // Render workout on list
        this._renderWorkout(workout)

        // hide form + clear input fields

        // cleam input fields
        this._hideForm();

        // Set local storage to all workouts
        this._setLocalStorage();
    }

    _renderWorkoutMarker(workout) {
        let marker;
        // helper function for checking what marker is selected
        const checkMarkerType = markerType => {
            if(markerType === `default`){
                marker = L.marker(workout.coords);
            } else if (markerType === `sphere`) {
                marker = L.circle((workout.coords), {
                    color: `#00c46a`,
                    fillColor: `#00c46a`,
                    fillOpacity: 0.5,
                    radius: 300,
                })
            } else if(markerType === `line`) {
                marker = L.polygon([workout.coords, [workout.coords[0], workout.coords[1] - 0.004]]);
            }
        }
        // if current workout has its own marker style
        if(workout.marker) {
            checkMarkerType(workout.marker);
        }
        // if current workout doesn't has its own marker style
        if(!workout.marker){
            checkMarkerType(this.#markerType);
            workout.marker = this.#markerType;
        }
        this.#markers.push(marker);
        marker
        .addTo(this.#map)
        .bindPopup(L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
        }))
        .setPopupContent(`${workout.type === `running` ? `🏃‍♂️` : `🚴‍♀️`} ${workout.description}`)
        .openPopup();
    }

    _renderWorkout(workout){
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <i class="fas fa-trash delete-workout"></i>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === `running` ? `🏃‍♂️` : `🚴‍♀️`}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`

        if(workout.type === `running`) {
            html += `
            <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`
        }

        if(workout.type === `cycling`) {
            html += `
            <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`
        }

        form.insertAdjacentHTML(`afterend`, html);
    }

    _moveToPopup(e) {
        const workoutEl = e.target.closest(`.workout`);

        if(!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        if(e.target.classList.contains(`fas`)) {
            // setting to display none when clicked on workout
            workoutEl.style.display = `none`
            // finding that workout from the workouts array
            const workoutIndex = this.#workouts.findIndex(work => work.id === workoutEl.dataset.id);
            // removing that workout from array
            this.#workouts.splice(workoutIndex, 1);
            // removing the marker related to current workout
            this.#map.removeLayer(this.#markers[workoutIndex]);
            // removing the marker from the marker array
            this.#markers.splice(workoutIndex, 1);
            // setting the local storage again
            this._setLocalStorage();
            // terminating the method
            return;
        }

        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1,
            }
        })

        // using the public interface
        workout.click();
    }

    _setLocalStorage() {
        localStorage.setItem(`workout`, JSON.stringify(this.#workouts))
    }

    _getLocalStorage() {
       const data = JSON.parse(localStorage.getItem(`workout`))
       if(!data) return;
       data.forEach(work => {
            if(work.type === `running`) {
                work.__proto__ = Object.create(Running.prototype)
            } else if(work.type === `cycling`) {
                work.__proto__ = Object.create(Cycling.prototype)
            }
        })

       this.#workouts = data;
       this.#workouts.forEach(work => {
           this._renderWorkout(work);
       });
    }
    reset() {
        localStorage.removeItem(`workout`);
        location.reload();
    }
    _sortWorkout() {
        // will figure it out soon enough
        

        // Will add it soon tommorrow InshahAllah
    }
    _deleteALlWorkout() {
        [...document.querySelectorAll(`.workout`)].forEach((el, i) => {
            el.style.display = `none`
            this.#map.removeLayer(this.#markers[i]);
        });
        this.#workouts = [];
        this.#markers = [];
        localStorage.removeItem(`workout`);
    }
    _emptyInputs(){
        inputDistance.value = inputCadence.value = inputDuration.value = inputElevation.value = ``;
    }
    _togglePopup(){
        errorPopup.classList.toggle(`popup-scaler`);
        overlay.classList.toggle(`overlay-hider`);
    }
    _panMap(e) {
        e.stopPropagation();
        if(!this.#workouts[0]){
            return;
        }
        const coordsArr = []
        this.#workouts.forEach(work => coordsArr.push(work.coords));
        this.#map.fitBounds(coordsArr, {
            padding: [50, 50],
            maxZoom: 12,
        });
    }
    _selectMarker(e) {
        e.stopPropagation();
        this.#markerType = markerInput.value;
    }
}

const app = new App();

