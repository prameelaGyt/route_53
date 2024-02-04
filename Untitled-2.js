
const slots={
1702720800: false,
1702722600: false,
1702726200: false,
1702729800: false,
1702773000: false,
1702773100: false,
1702812600: false,
1702852200: false,
1702859400: false,
1702924010: false,
1702945800: false,
1702985400: false,
1703010410: false,
1700992800: false,
1700994600: false,
1700996400: false,
1700998200: false,
1701000000: false,
1703010410:false,
1700992800:false,
1700994600:false,
1700996400:false,
1700998200:false,
1701000000:false
}

const configuration = {
    start_date:1702636200,
    end_date:1703500200,
    moonday_availability: '10:00AM - 5:00PM',
    tuesday_availability: '10:00AM - 5:00PM',
    wednesday_availability: '10:00AM - 5:00PM',
    thursday_availability: '10:00AM - 5:00PM',
    friday_availability: '10:00AM - 5:00PM',
    saturday_availability: '10:00AM - 5:00PM',
    sunday_availability: 'not available'
};


function updateSlots(start_date, end_date) {
    const updatedSlots = { ...slots };
    const days = ['sunday', 'moonday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let timestamp in updatedSlots) {
        if (timestamp >= start_date && timestamp <= end_date) {
            const date = new Date(parseInt(timestamp) * 1000); // Parse timestamp to integer
            const dayOfWeek = days[date.getDay()];

            if (configuration[dayOfWeek + '_availability'] !== 'not available') {
                const availability = configuration[dayOfWeek + '_availability'];
                const timeRange = availability.split(' - ');
                const startTime = getTimeFromDateStr(timeRange[0]); // Helper function to get time
                const endTime = getTimeFromDateStr(timeRange[1]); // Helper function to get time

                const timestampTime = date.getHours() * 3600 + date.getMinutes() * 60; // Convert timestamp time to seconds

                if (timestampTime >= startTime && timestampTime <= endTime) {
                    updatedSlots[timestamp] = true;
                }
            }
        }
    }

    return updatedSlots;
}

// Helper function to get time from "HH:MM[AM/PM]" format
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

// Test the function
const updatedSlotsResult = updateSlots(configuration.start_date, configuration.end_date);
console.log(updatedSlotsResult);


    