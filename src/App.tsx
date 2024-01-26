import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input';
import { Label } from '@radix-ui/react-label';
import { add, fromUnixTime, getUnixTime, lastDayOfMonth, startOfMonth, startOfToday, sub } from 'date-fns';
import { useEffect, useState } from 'react';

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

const HOURS_COLOR = '#a7f3d0';
const MILES_COLOR = '#e9d5ff';

const API_ROOT = "http://localhost:3030/";

const TZ_OFFSET_SEC = new Date().getTimezoneOffset() * 60;

function locToUtcUnix(localDate: Date): number {
  return getUnixTime(localDate)-TZ_OFFSET_SEC;
}


// NOTE: the 'both' class must be kept below the other classes to pull priority over the previous classes when rendering
const datesCss = `
  .hours {
    background-image: linear-gradient(to top left, transparent 50%, ${HOURS_COLOR} 0);
  }

  .miles {
    background-image: linear-gradient(to bottom right, transparent 50%, ${MILES_COLOR} 0);
  }

  .both {
    background-image: linear-gradient(to bottom right, transparent 50%, ${MILES_COLOR} 0),
                      linear-gradient(to top left, transparent 50%, ${HOURS_COLOR} 0);
  }

`

// TODO: Handle the errors
async function apiFetchDateInfo(utcUnixFrom: number, utcUnixTo: number): Promise<DateInfo[]> {
  const res = await fetch(`${API_ROOT}?from=${utcUnixFrom}&to=${utcUnixTo}`);
  return await res.json();
}

async function apiDeleteDateInfo(utcUnixDate: number) {
  await fetch(
    `${API_ROOT}?date=${utcUnixDate}`,
    {
      method: 'DELETE'
    }
  );
}

async function apiSetDateInfo(info: DateInfo) {
  await fetch(
    `${API_ROOT}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(info)
    }
  )
}

function App() {

  const [datesStart, setDatesStart] = useState(startOfMonth(sub(new Date(), {months: 1})));
  const [datesEnd, setDatesEnd] = useState(lastDayOfMonth(new Date()));
  const [dateInfoUtc, setDateInfoUtc] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfToday());
  const [hours, setHours] = useState('');
  const [miles, setMiles] = useState('');

  // Computed dates lists for the calendar styling
  const bothDates = dateInfoUtc.filter(d => d.hours > 0 && d.miles > 0).map(d => fromUnixTime(d.date + TZ_OFFSET_SEC));
  const hoursDates = dateInfoUtc.filter(d => d.hours > 0).map(d => fromUnixTime(d.date + TZ_OFFSET_SEC)); 
  const milesDates = dateInfoUtc.filter(d => d.miles > 0).map(d => fromUnixTime(d.date + TZ_OFFSET_SEC)); 
  // Computed var for the selected date
  const selectedInfo = dateInfoUtc.find(
    d => selectedDate && d.date === locToUtcUnix(selectedDate)
  );

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
  

  // Load the DateInfo for the shown months on first render
  useEffect(() => {
    apiFetchDateInfo(
      locToUtcUnix(datesStart),
      locToUtcUnix(datesEnd)
    ).then(dateInfos => {
      setDateInfoUtc(dateInfos); 
    })
  }, [])


  async function handleSubmit() {
    const hFloat = parseFloat(hours);
    const mFloat = parseFloat(miles);

    // If they are both set to 0 then delete the day from the DB
    if (hFloat === 0 && mFloat === 0) {
      await apiDeleteDateInfo(locToUtcUnix(selectedDate as Date));
    }
    // ELSE - modify the day
    else {
      await apiSetDateInfo({
        date: locToUtcUnix(selectedDate as Date),
        hours: parseFloat(hours),
        miles: parseFloat(miles),
      })
    }

    // Re pull the modified data
    setDateInfoUtc(await apiFetchDateInfo(
      locToUtcUnix(datesStart), 
      locToUtcUnix(datesEnd)
    ));
  }

  function handleMonthChange(m: Date) {
    const ds = m;
    const de = lastDayOfMonth(add(m, {months: 1}));
    setDatesStart(ds);
    setDatesEnd(de);
    apiFetchDateInfo(locToUtcUnix(ds), locToUtcUnix(de))
      .then(infos => setDateInfoUtc(infos))
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
