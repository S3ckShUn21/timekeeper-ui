import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input';
import { Label } from '@radix-ui/react-label';
import { add, fromUnixTime, getUnixTime, lastDayOfMonth, startOfMonth, startOfToday, sub } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/*
 * Note for future Cole about handling timezone conversions...
 * 
 *   For starters, the dates are stored as UTC unix timestamps for 00:00 of a particular day. This is 
 *   important as that will, in every case but 1, be different to the 00:00 unix timestamp of your
 *   given timezone...
 * 
 *   Going from SERVER dates (12AM UTC date) to CLIENT dates (whatever the current locale of the device is)
 *   you have to ADD the tzOffsetSeconds to the SERVER date
 *
 *   Going from CLIENT dates (12AM whatever TZ you're in) to SERVER dates (back to UTC 12AM) you have to 
 *   SUBTRACT the tzOffsetSeconds from the date given by the Calendar component (which always shows you dates
 *   in your current tz) - this is also true for any Date created by `new Date()`
 *
 */

interface DateInfo {
  date: number,
  hours: number,
  miles: number,
}

const hoursColor = '#a7f3d0';
const milesColor = '#e9d5ff';

// NOTE: the 'both' class must be kept below the other classes to pull priority over the previous classes when rendering
const datesCss = `
  .hours {
    background-image: linear-gradient(to top left, transparent 50%, ${hoursColor} 0);
  }

  .miles {
    background-image: linear-gradient(to bottom right, transparent 50%, ${milesColor} 0);
  }

  .both {
    background-image: linear-gradient(to bottom right, transparent 50%, ${milesColor} 0),
                      linear-gradient(to top left, transparent 50%, ${hoursColor} 0);
  }

`


function App() {
  const tzOffsetSec = new Date().getTimezoneOffset() * 60;

  const [datesStart, setDatesStart] = useState(startOfMonth(sub(new Date(), {months: 1})));
  const [datesEnd, setDatesEnd] = useState(lastDayOfMonth(new Date()));
  const [dateInfoUtc, setDateInfoUtc] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());
  const [hours, setHours] = useState('');
  const [miles, setMiles] = useState('');

  // Computed dates lists for the calendar styling
  const bothDates = dateInfoUtc.filter(d => d.hours > 0 && d.miles > 0).map(d => fromUnixTime(d.date + tzOffsetSec));
  const hoursDates = dateInfoUtc.filter(d => d.hours > 0).map(d => fromUnixTime(d.date + tzOffsetSec)); 
  const milesDates = dateInfoUtc.filter(d => d.miles > 0).map(d => fromUnixTime(d.date + tzOffsetSec)); 
  // Computed vars for the selected date
  const selectedDateUtcUnix = selectedDate ? getUnixTime(selectedDate)-tzOffsetSec : undefined;
  const selectedInfo = dateInfoUtc.find(d => selectedDateUtcUnix && d.date === selectedDateUtcUnix);

  // Update the form at the bottom of the page when the selected date changes
  useEffect(() => {
    if (selectedInfo) {
      setHours(selectedInfo.hours.toFixed(2));
      setMiles(selectedInfo.miles.toFixed(2));
    } else {
      setHours('');
      setMiles('');
    }
  }, [selectedInfo])
  

  // This function gets all the date info for the months currently shown on screen
  const fetchDateInfo = useCallback(async () => {
    const resp = await fetch(
      `http://localhost:3030?from=${
        getUnixTime(datesStart)-tzOffsetSec
      }&to=${
        getUnixTime(datesEnd)-tzOffsetSec
      }`
    );
    const di = await resp.json();
    // console.log(di);
    setDateInfoUtc(di);
  }, [datesStart, datesEnd]);


  // Load the DateInfo for the shown months on first render
  useEffect(() => {
    fetchDateInfo();
  }, [])


  async function handleSubmit() {
    const hFloat = parseFloat(hours);
    const mFloat = parseFloat(miles);

    // If they are both set to 0 then delete the day from the DB
    if (hFloat === 0 && mFloat === 0) {
      await fetch(`http://localhost:3030?date=${selectedDateUtcUnix}`, {
        method: 'DELETE'
      });
    }
    // ELSE - modify the day
    else {
      await fetch(
        'http://localhost:3030/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'          
          },
          body: JSON.stringify({
            date: selectedDateUtcUnix,
            hours: parseFloat(hours),
            miles: parseFloat(miles),
          })
        }
      );
    }

    // Re pull the modified data
    fetchDateInfo();
  }

  function handleMonthChange(m: Date) {
    flushSync(() => {
      setDatesStart(m);
      setDatesEnd(lastDayOfMonth(add(m, {months: 1})));
    });
    fetchDateInfo();    
  }

  return (
    <div className='h-screen w-screen p-2'>
      <div className='w-11/12 max-w-screen-sm mx-auto flex flex-col items-center gap-2'>
        <h3 className='text-center scroll-m-20 text-xl font-semibold tracking-tight'>Timekeeper</h3>
        <div className='h-min w-min'>
          <style>{datesCss}</style>
          <Calendar 
            mode = 'single'
            className='rounded-md border shadow'
            modifiersClassNames={{ 
              today: 'underline', 
              both: 'both',
              hours: 'hours',
              miles: 'miles',
            }}
            modifiers={{
              both: bothDates,
              hours: hoursDates,
              miles: milesDates,
            }}
            numberOfMonths={ 2 }
            defaultMonth={datesStart}
            fixedWeeks
            selected={selectedDate}
            onSelect={setSelectedDate}
            onMonthChange={handleMonthChange}
          />
        </div>
        <div className='w-full flex-grow p-2 flex flex-col gap-2 items-center'>
          <div className='w-full'>
            <Label htmlFor='hours'>Hours</Label>
            <Input 
              type='number' 
              id='hours' 
              placeholder='8.0' 
              disabled={selectedDate === undefined}
              value={hours}
              onChange={e => setHours(e.target.value)}
            />
          </div>
          <div className='w-full'>
            <Label htmlFor='miles'>Miles</Label>
            <Input 
              type='number' 
              id='miles' 
              placeholder='60' 
              disabled={selectedDate === undefined}
              value={miles}
              onChange={e => setMiles(e.target.value)}
            />
          </div>
          <Button 
            disabled={
              selectedDate === undefined ||
              !miles ||
              !hours
            }
            onClick={async () => {
              await handleSubmit(); 
            }} 
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  )
}

export default App
