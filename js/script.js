/* ---- Light/dark theme ---- */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
}
function initTheme(){
  var saved = null;
  try{ saved = localStorage.getItem('whetstone_theme'); }catch(err){}
  if(saved){
    applyTheme(saved);
  } else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches){
    applyTheme('light');
  }
}
function toggleTheme(){
  var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try{ localStorage.setItem('whetstone_theme', next); }catch(err){}
}
initTheme();

/* ---- Mobile nav ---- */
function toggleMobileNav(){
  var nav = document.getElementById('navLinks');
  var open = nav.classList.toggle('open');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ---- Promo popup (shown once per visitor, any page) ---- */
function showPromoIfNeeded(){
  try{
    if(!localStorage.getItem('whetstone_seen_promo')){
      setTimeout(function(){
        var overlay = document.getElementById('promoOverlay');
        if(overlay) overlay.classList.add('open');
      }, 1200);
    }
  }catch(err){ /* storage unavailable, skip popup */ }
}
function closePromo(){
  var overlay = document.getElementById('promoOverlay');
  if(overlay) overlay.classList.remove('open');
  try{ localStorage.setItem('whetstone_seen_promo', '1'); }catch(err){}
}

document.addEventListener('DOMContentLoaded', function(){
  var overlay = document.getElementById('promoOverlay');
  if(overlay){
    overlay.addEventListener('click', function(e){
      if(e.target === this) closePromo();
    });
  }
  showPromoIfNeeded();

  var dateInput = document.getElementById('fdate');
  if(dateInput){
    var d = new Date();
    dateInput.min = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  }
});

/* ---- Booking + calendar (contact.html only) ---- */
var SERVICE_DURATIONS = {
  'Classic Cut':45, 'Skin Fade':45, 'Scissor Cut':45, 'Kids Cut':30,
  'Beard Trim & Shape':30, 'Hot Towel Straight Razor Shave':45, 'Beard Trim + Line Up':30,
  'Cut + Beard Combo':60, 'The Full Strop':75, 'Father & Son':60,
  'Line Up':15, 'Grey Blending':40
};

function pad(n){ return n < 10 ? '0' + n : '' + n; }
function icsDate(d){
  return d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}
function escapeICS(s){ return String(s).replace(/([,;])/g, '\\$1'); }

function showFormError(msg){
  var el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearFormError(){
  document.getElementById('formError').style.display = 'none';
}

async function submitBooking(e){
  e.preventDefault();
  clearFormError();
  var name = document.getElementById('fname').value;
  var phone = document.getElementById('fphone').value;
  var email = document.getElementById('femail').value;
  var serviceFull = document.getElementById('fservice').value;
  var serviceName = serviceFull.split(' — ')[0];
  var barber = document.getElementById('fbarber').value;
  var dateStr = document.getElementById('fdate').value;
  var timeStr = document.getElementById('ftime').value;

  var start = new Date(dateStr + 'T' + timeStr + ':00');
  var duration = SERVICE_DURATIONS[serviceName] || 45;
  var end = new Date(start.getTime() + duration * 60000);

  var now = new Date();
  if(start.getTime() < now.getTime()){
    showFormError('That date and time has already passed — please choose a future slot.');
    return false;
  }
  var day = start.getDay(); // 0 = Sunday, 1 = Monday
  if(day === 0 || day === 1){
    showFormError('We\'re closed Sundays and Mondays — please pick Tuesday to Saturday.');
    return false;
  }
  var openHour = (day === 6) ? 8 : 9;   // Saturday opens 08:00, Tue–Fri opens 09:00
  var closeHour = (day === 6) ? 17 : 19; // Saturday closes 17:00, Tue–Fri closes 19:00
  var startMinutes = start.getHours() * 60 + start.getMinutes();
  var lastBookableMinutes = closeHour * 60 - duration;
  if(startMinutes < openHour * 60 || startMinutes > lastBookableMinutes){
    showFormError('Please pick a time between ' + pad(openHour) + ':00 and ' + pad(closeHour) + ':00 that leaves room for your ' + duration + '-minute service.');
    return false;
  }

  /* Save the booking to the database, if one is configured */
  var submitBtn = document.querySelector('#bookingForm .submit-btn');
  if(typeof supabaseClient !== 'undefined' && supabaseClient){
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    var dbDate = start.getFullYear() + '-' + pad(start.getMonth()+1) + '-' + pad(start.getDate());
    var dbTime = pad(start.getHours()) + ':' + pad(start.getMinutes());
   /* Check whether this barber is already booked for an overlapping time */
var requestedStart = start.getTime();
var requestedEnd = end.getTime();

var existingBookings = await supabaseClient
  .from('bookings')
  .select('appointment_time, duration_minutes, barber')
  .eq('appointment_date', dbDate)
  .eq('barber', barber);

if (existingBookings.error) {
  submitBtn.disabled = false;
  submitBtn.textContent = 'Request booking';

  showFormError(
    'Could not check availability. Please try again. (' +
    existingBookings.error.message +
    ')'
  );

  return false;
}

/* Check each existing booking for a time overlap */
var isOccupied = existingBookings.data.some(function(booking) {
  var bookedStart = new Date(
    dbDate + 'T' + booking.appointment_time
  );

  var bookedDuration = Number(booking.duration_minutes) || 45;
  var bookedEnd = new Date(
    bookedStart.getTime() + bookedDuration * 60000
  );

  return requestedStart < bookedEnd.getTime() &&
         requestedEnd > bookedStart.getTime();
});

if (isOccupied) {
  submitBtn.disabled = false;
  submitBtn.textContent = 'Request booking';

  showFormError(
    'That time is already occupied for ' +
    barber +
    '. Please choose another time or barber.'
  );

  return false;
}

/* No conflict — save the booking */
var result = await supabaseClient.from('bookings').insert({
  name: name,
  phone: phone,
  email: email,
  service: serviceFull,
  barber: barber,
  appointment_date: dbDate,
  appointment_time: dbTime,
  duration_minutes: duration
});
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request booking';
    if(result.error){
      showFormError('Could not save your booking — please try again or call us directly. (' + result.error.message + ')');
      return false;
    }
  }

  var location = '214 Foundry Lane, Woodstock, Cape Town, 7925';
  var title = 'CROWN & CUT BARBERS ' + serviceName;
  var details = 'Service: ' + serviceFull + '\\nBarber: ' + barber + '\\nBooked for: ' + name +
    '\\nPhone: ' + document.getElementById('fphone').value + '\\nPlease arrive 5 minutes early.';

  var friendlyDate = start.toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  var friendlyTime = start.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});

  document.getElementById('confirmText').textContent =
    'Thanks, ' + name + '. Your ' + serviceName + ' with ' + barber + ' is requested for ' +
    friendlyDate + ' at ' + friendlyTime + '. We\'ll confirm by phone or email shortly.';

  /* .ics file: Google Calendar & Apple Calendar compatible */
  var icsContent = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Whetstone Barber Co.//Booking//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + Date.now() + '@whetstonebarber.co.za',
    'DTSTAMP:' + icsDate(new Date()),
    'DTSTART:' + icsDate(start),
    'DTEND:' + icsDate(end),
    'SUMMARY:' + escapeICS(title),
    'DESCRIPTION:' + escapeICS(details),
    'LOCATION:' + escapeICS(location),
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');

  var blob = new Blob([icsContent], {type:'text/calendar;charset=utf-8'});
  document.getElementById('icsLink').href = URL.createObjectURL(blob);

  /* Google Calendar link using the actual selected details */
  var gStart = icsDate(start), gEnd = icsDate(end);
  var gUrl = 'https://www.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(title) +
    '&dates=' + gStart + '/' + gEnd +
    '&details=' + encodeURIComponent('Service: ' + serviceFull + ' | Barber: ' + barber + ' | Booked for: ' + name) +
    '&location=' + encodeURIComponent(location);
  document.getElementById('googleCalLink').href = gUrl;

  document.getElementById('confirmBox').style.display = 'block';
  document.getElementById('bookingForm').reset();
  return false;
}
