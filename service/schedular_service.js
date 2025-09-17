
const apiClient = require("../config/apiClient");
const prisma = require("../config/prismaConfig");
const { weatherData } = require("./weatherConfig");
require('dotenv').config();




async function triggerAllDaily(data,group) {
    try {
        // console.log('🔄 Triggering downlink to all multicast groups');
        // const groupResponse = await apiClient.get('/api/multicast-groups', {
        //     params: {
        //         limit: 100,
        //         applicationId: process.env.APPLICATION_ID,
        //     },
        // });
        // console.log(`Fetched ${groupResponse.data?.result?.length || 0} multicast groups`);

        // const groups = groupResponse.data?.result || [];
        if(!group || group.length ===0){
            console.log("No multicast groups provided to trigger downlink.");
            return;
        }
        console.log(`Proceeding to send downlink to ${group.length} provided multicast groups.`);

        for (const group of group) {
            console.log(`Sending downlink to devices in group: ${group.name} (${group.id})`);

            try {
                const deviceResponse = await apiClient.get('/api/devices', {
                    params: {
                        limit: 1000,
                        applicationId: process.env.APPLICATION_ID,
                        multicastGroupId: group.id,
                    },
                });

                const devices = deviceResponse.data?.result || [];

                console.log(`Fetched ${devices.length} devices from group: ${group.name}`);

                for (const device of devices) {
                    try {
                        await apiClient.post(`/api/devices/${device.devEui}/queue`, {
                            queueItem: {
                                data: data,
                                fCnt: 0,
                                fPort: 1,
                                confirmed: true,
                            },
                        });

                        console.log(`✅ Downlink sent to device ${device.devEui} successfully`);
                    } catch (error) {
                        console.error(`❌ Error sending downlink to device ${device.devEui}:`, error.response?.data || error.message);
                    }
                }

                // Add delay between groups to avoid server overload
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`❌ Error fetching devices for group ${group.name} (${group.id}):`, error.response?.data || error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error fetching multicast groups:', error.response?.data || error.message);
    }
}

async function CheckWeatherData(){
    try {

        const result = await prisma.thresoldWeatherData.findMany({
            orderBy:{createdAt :"desc"},
            select:{
                rain_gauge:true ,
                wind_speed:true,
                wind_speed_level:true,
                wind_direction:true,
                wind_direction_angle:true}
        })

        if(!result ){
            throw new Error("No weather data found");
        }

        if(weatherData.rain_gauge > result.rain_gauge || weatherData.wind_speed > result.wind_speed){
            return false // condition failes not to trigger
        }
        return true // condition satisfies to trigger
        
    } catch (error) {
        console.log("Error on checking weather data:", error.message);
        throw error;
        
    }

}