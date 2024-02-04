const slots = {
    '1700992800': false,
    '1700994600': false,
    '1700996400': false,
    '1700998200': false,
    '1701000000': false,
    '1702720800': false,
    '1702722600': false,
    '1702726200': false,
    '1702729800': false,
    '1702773000': false,
    '1702773100': false,
    '1702812600': false,
    '1702852200': false,
    '1702859400': false,
    '1702924010': false,
    '1702945800': false,
    '1702985400': false,
    '1703010410': false,
  };
  
  const configuration = {
    start_date: 1702636200,
    end_date: 1703039400,
    monday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    tuesday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    wednesday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    thursday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    friday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    saturday_availability: getTimeFromDateStr("10:00AM - 5:00PM"),
    sunday_availability: false, // Sunday availability should be true or false
  };
  
  function updateSlots(start_date, end_date) {
    const updatedSlots = { ...slots };
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  
    for (let timestamp in updatedSlots) {
      const timestampInt = parseInt(timestamp, 10);
      if (timestampInt >= start_date && timestampInt <= end_date) {
        const date = new Date(timestampInt * 1000);
        const dayOfWeek = days[date.getUTCDay()];
  
        if (configuration[dayOfWeek + "_availability"] !== false) {
          const availability = configuration[dayOfWeek + "_availability"];
          const timestampTime = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60;
  
          if (timestampTime >= availability && timestampTime <= configuration[dayOfWeek + "_availability"] + 36000) {
            updatedSlots[timestamp] = true;
          }
        }
      }
    }
  
    return updatedSlots;
  }
  
  // Test the function
  const updatedSlotsResult = updateSlots(configuration.start_date, configuration.end_date);
  console.log(updatedSlotsResult);

  function getTimeFromDateStr(timeStr) {
    const [time, meridiem] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    let hours24 = parseInt(hours, 10);
  
    if (meridiem === 'PM' && hours24 !== 12) {
      hours24 += 12;
    } else if (meridiem === 'AM' && hours24 === 12) {
      hours24 = 0;
    }
  
    return hours24 * 3600 + parseInt(minutes, 10) * 60;
  }
  
  