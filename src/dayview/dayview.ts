import { DatePipe } from '@angular/common';
import { Slides } from 'ionic-angular';
import { Component, OnInit, OnChanges, HostBinding, Input, Output, EventEmitter, SimpleChanges, ViewChild, ViewEncapsulation, TemplateRef, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { ICalendarComponent, IDayView, IDayViewRow, IDisplayEvent, IEvent, ITimeSelected, IRange, CalendarMode, IDateFormatter } from '../calendar';
import { CalendarService } from '../calendar.service';
import { IDisplayAllDayEvent } from "../calendar";

@Component({
    selector: 'dayview',
    template: './dayview.html',
    styles: ['./dayview.css'],
    encapsulation: ViewEncapsulation.None
})
export class DayViewComponent implements ICalendarComponent, OnInit, OnChanges {

    @ViewChild('daySlider') slider:Slides;
    @HostBinding('class.dayview') class = true;

    @Input() dayviewAllDayEventTemplate:TemplateRef<IDisplayAllDayEvent>;
    @Input() dayviewNormalEventTemplate:TemplateRef<IDisplayEvent>;

    @Input() formatHourColumn:string;
    @Input() formatDayTitle:string;
    @Input() allDayLabel:string;
    @Input() hourParts:number;
    @Input() eventSource:IEvent[];
    @Input() markDisabled:(date:Date) => boolean;
    @Input() locale:string;
    @Input() dateFormatter:IDateFormatter;
    @Input() dir:string = "";
    @Input() scrollToHour:number = 0;
    @Input() preserveScrollPosition:boolean;
    @Input() lockSwipeToPrev:boolean;
    @Input() lockSwipes:boolean;
    @Input() startHour:number;
    @Input() endHour:number;
    @Input() spaceBetween:number;

    @Output() onRangeChanged = new EventEmitter<IRange>();
    @Output() onEventSelected = new EventEmitter<IEvent>();
    @Output() onTimeSelected = new EventEmitter<ITimeSelected>();
    @Output() onTitleChanged = new EventEmitter<string>(true);

    public slideOption = {
        runCallbacksOnInit: false,
        loop: true
    };
    public views:IDayView[] = [];
    public currentViewIndex = 0;
    public direction = 0;
    public mode:CalendarMode = 'day';
    public range:IRange;

    private inited = false;
    private callbackOnInit = true;
    private currentDateChangedFromParentSubscription:Subscription;
    private eventSourceChangedSubscription:Subscription;
    private hourColumnLabels:string[];
    private initScrollPosition:number;
    private formatTitle:(date:Date) => string;
    private formatHourColumnLabel:(date:Date) => string;
    private hourRange:number;

    constructor(private calendarService:CalendarService, private elm:ElementRef) {
    }

    ngOnInit() {
        this.hourRange = this.endHour - this.startHour;
        if (this.dateFormatter && this.dateFormatter.formatDayViewTitle) {
            this.formatTitle = this.dateFormatter.formatDayViewTitle;
        } else {
            var datePipe = new DatePipe(this.locale);
            this.formatTitle = function (date:Date) {
                return datePipe.transform(date, this.formatDayTitle);
            };
        }

        if (this.dateFormatter && this.dateFormatter.formatDayViewHourColumn) {
            this.formatHourColumnLabel = this.dateFormatter.formatDayViewHourColumn;
        } else {
            var datePipe = new DatePipe(this.locale);
            this.formatHourColumnLabel = function (date:Date) {
                return datePipe.transform(date, this.formatHourColumn);
            };
        }

        if (this.lockSwipeToPrev) {
            this.slider.lockSwipeToPrev(true);
        }

        if (this.lockSwipes) {
            this.slider.lockSwipes(true);
        }

        this.refreshView();
        this.hourColumnLabels = this.getHourColumnLabels();

        this.inited = true;

        this.currentDateChangedFromParentSubscription = this.calendarService.currentDateChangedFromParent$.subscribe(currentDate => {
            this.refreshView();
        });

        this.eventSourceChangedSubscription = this.calendarService.eventSourceChanged$.subscribe(() => {
            this.onDataLoaded();
        });
    }

    ngAfterViewInit() {
        let title = this.getTitle();
        this.onTitleChanged.emit(title);

        if (this.scrollToHour > 0) {
            let hourColumns = this.elm.nativeElement.querySelector('.dayview-normal-event-container').querySelectorAll('.calendar-hour-column');
            var me = this;
            setTimeout(function () {
                me.initScrollPosition = hourColumns[me.scrollToHour - me.startHour].offsetTop;
            }, 0);
        }
    }

    ngOnChanges(changes:SimpleChanges) {
        if (!this.inited) return;

        let eventSourceChange = changes['eventSource'];
        if (eventSourceChange && eventSourceChange.currentValue) {
            this.onDataLoaded();
        }

        let lockSwipeToPrev = changes['lockSwipeToPrev'];
        if (lockSwipeToPrev) {
            this.slider.lockSwipeToPrev(lockSwipeToPrev.currentValue);
        }

        let lockSwipes = changes['lockSwipes'];
        if (lockSwipes) {
            this.slider.lockSwipes(lockSwipes.currentValue);
        }
    }

    ngOnDestroy() {
        if (this.currentDateChangedFromParentSubscription) {
            this.currentDateChangedFromParentSubscription.unsubscribe();
            this.currentDateChangedFromParentSubscription = null;
        }

        if (this.eventSourceChangedSubscription) {
            this.eventSourceChangedSubscription.unsubscribe();
            this.eventSourceChangedSubscription = null;
        }
    }

    onSlideChanged() {
        if (this.callbackOnInit) {
            this.callbackOnInit = false;
            return;
        }

        let currentSlideIndex = this.slider.getActiveIndex(),
            direction = 0,
            currentViewIndex = this.currentViewIndex;

        currentSlideIndex = (currentSlideIndex + 2) % 3;
        if (currentSlideIndex - currentViewIndex === 1) {
            direction = 1;
        } else if (currentSlideIndex === 0 && currentViewIndex === 2) {
            direction = 1;
            this.slider.slideTo(1, 0, false);
        } else if (currentViewIndex - currentSlideIndex === 1) {
            direction = -1;
        } else if (currentSlideIndex === 2 && currentViewIndex === 0) {
            direction = -1;
            this.slider.slideTo(3, 0, false);
        }
        this.currentViewIndex = currentSlideIndex;
        this.move(direction);
    }

    move(direction:number) {
        if (direction === 0) return;

        this.direction = direction;
        let adjacentDate = this.calendarService.getAdjacentCalendarDate(this.mode, direction);
        this.calendarService.setCurrentDate(adjacentDate);
        this.refreshView();
        this.direction = 0;
    }

    static createDateObjects(startTime:Date, startHour: number, endHour: number):IDayViewRow[] {
        let rows:IDayViewRow[] = [],
            time:Date,
            currentHour = startTime.getHours(),
            currentDate = startTime.getDate();

        for (let hour = startHour; hour < endHour; hour += 1) {
            time = new Date(startTime.getTime());
            time.setHours(currentHour + hour);
            time.setDate(currentDate);
            rows.push({
                time: time,
                events: []
            });
        }
        return rows;
    }

    private getHourColumnLabels():string[] {
        let hourColumnLabels:string[] = [];
        for (let hour = 0, length = this.views[0].rows.length; hour < length; hour += 1) {
            hourColumnLabels.push(this.formatHourColumnLabel(this.views[0].rows[hour].time));
        }
        return hourColumnLabels;
    }

    getViewData(startTime:Date):IDayView {
        return {
            rows: DayViewComponent.createDateObjects(startTime, this.startHour, this.endHour),
            allDayEvents: []
        };
    }

    getRange(currentDate:Date):IRange {
        let year = currentDate.getFullYear(),
            month = currentDate.getMonth(),
            date = currentDate.getDate(),
            startTime = new Date(year, month, date),
            endTime = new Date(year, month, date + 1);

        return {
            startTime: startTime,
            endTime: endTime
        };
    }

    onDataLoaded() {
        let eventSource = this.eventSource,
            len = eventSource ? eventSource.length : 0,
            startTime = this.range.startTime,
            endTime = this.range.endTime,
            utcStartTime = new Date(Date.UTC(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())),
            utcEndTime = new Date(Date.UTC(endTime.getFullYear(), endTime.getMonth(), endTime.getDate())),
            currentViewIndex = this.currentViewIndex,
            rows = this.views[currentViewIndex].rows,
            allDayEvents:IDisplayAllDayEvent[] = this.views[currentViewIndex].allDayEvents = [],
            oneHour = 3600000,
            eps = 0.016,
            normalEventInRange = false;

        for (let hour = 0; hour < this.hourRange; hour += 1) {
            rows[hour].events = [];
        }

        for (let i = 0; i < len; i += 1) {
            let event = eventSource[i];
            let eventStartTime = new Date(event.startTime.getTime());
            let eventEndTime = new Date(event.endTime.getTime());

            if (event.allDay) {
                if (eventEndTime <= utcStartTime || eventStartTime >= utcEndTime) {
                    continue;
                } else {
                    allDayEvents.push({
                        event: event
                    });
                }
            } else {
                if (eventEndTime <= startTime || eventStartTime >= endTime) {
                    continue;
                } else {
                    normalEventInRange = true;
                }

                let timeDiff:number;
                let timeDifferenceStart:number;
                if (eventStartTime <= startTime) {
                    timeDifferenceStart = 0;
                } else {
                    timeDiff = eventStartTime.getTime() - startTime.getTime() - (eventStartTime.getTimezoneOffset() - startTime.getTimezoneOffset()) * 60000;
                    timeDifferenceStart = timeDiff / oneHour;
                }

                let timeDifferenceEnd:number;
                if (eventEndTime >= endTime) {
                    timeDiff = endTime.getTime() - startTime.getTime() - (endTime.getTimezoneOffset() - startTime.getTimezoneOffset()) * 60000;
                    timeDifferenceEnd = timeDiff / oneHour;
                } else {
                    timeDiff = eventEndTime.getTime() - startTime.getTime() - (eventEndTime.getTimezoneOffset() - startTime.getTimezoneOffset()) * 60000;
                    timeDifferenceEnd = timeDiff / oneHour;
                }

                let startIndex = Math.floor(timeDifferenceStart);
                let endIndex = Math.ceil(timeDifferenceEnd - eps);
                let startOffset = 0;
                let endOffset = 0;
                if (this.hourParts !== 1) {
                    if(startIndex < this.startHour) {
                        startOffset = 0;
                    } else {
                        startOffset = Math.floor((timeDifferenceStart - startIndex) * this.hourParts);
                    }
                    if(endIndex > this.endHour) {
                        endOffset = 0;
                    } else {
                        endOffset = Math.floor((endIndex - timeDifferenceEnd) * this.hourParts);
                    }
                }

                if(startIndex < this.startHour) {
                    startIndex = 0;
                } else {
                    startIndex -= this.startHour;
                }
                if(endIndex > this.endHour) {
                    endIndex = this.endHour;
                }
                endIndex -= this.startHour;

                if(startIndex < endIndex) {
                    let displayEvent = {
                        event: event,
                        startIndex: startIndex,
                        endIndex: endIndex,
                        startOffset: startOffset,
                        endOffset: endOffset
                    };

                    let eventSet = rows[startIndex].events;
                    if (eventSet) {
                        eventSet.push(displayEvent);
                    } else {
                        eventSet = [];
                        eventSet.push(displayEvent);
                        rows[startIndex].events = eventSet;
                    }
                }
            }
        }

        if (normalEventInRange) {
            let orderedEvents:IDisplayEvent[] = [];
            for (let hour = 0; hour < this.hourRange; hour += 1) {
                if (rows[hour].events) {
                    rows[hour].events.sort(DayViewComponent.compareEventByStartOffset);

                    orderedEvents = orderedEvents.concat(rows[hour].events);
                }
            }
            if (orderedEvents.length > 0) {
                this.placeEvents(orderedEvents);
            }
        }
    }

    refreshView() {
        this.range = this.getRange(this.calendarService.currentDate);
        if (this.inited) {
            let title = this.getTitle();
            this.onTitleChanged.emit(title);
        }

        this.calendarService.populateAdjacentViews(this);
        this.calendarService.rangeChanged(this);
    }

    getTitle():string {
        let startingDate = new Date(this.range.startTime.getTime());
        startingDate.setHours(12, 0,0,0);
        return this.formatTitle(startingDate);
    }

    private static compareEventByStartOffset(eventA:IDisplayEvent, eventB:IDisplayEvent) {
        return eventA.startOffset - eventB.startOffset;
    }

    select(selectedTime:Date, events:IDisplayEvent[]) {
        let disabled = false;
        if (this.markDisabled) {
            disabled = this.markDisabled(selectedTime);
        }

        this.onTimeSelected.emit({
            selectedTime: selectedTime,
            events: events.map(e => e.event),
            disabled: disabled
        });
    }

    placeEvents(orderedEvents:IDisplayEvent[]) {
        this.calculatePosition(orderedEvents);
        DayViewComponent.calculateWidth(orderedEvents, this.hourRange, this.hourParts);
    }

    placeAllDayEvents(orderedEvents:IDisplayEvent[]) {
        this.calculatePosition(orderedEvents);
    }

    overlap(event1:IDisplayEvent, event2:IDisplayEvent):boolean {
        let earlyEvent = event1,
            lateEvent = event2;
        if (event1.startIndex > event2.startIndex || (event1.startIndex === event2.startIndex && event1.startOffset > event2.startOffset)) {
            earlyEvent = event2;
            lateEvent = event1;
        }

        if (earlyEvent.endIndex <= lateEvent.startIndex) {
            return false;
        } else {
            return !(earlyEvent.endIndex - lateEvent.startIndex === 1 && earlyEvent.endOffset + lateEvent.startOffset >= this.hourParts);
        }
    }

    calculatePosition(events:IDisplayEvent[]) {
        let len = events.length,
            maxColumn = 0,
            col:number,
            isForbidden:boolean[] = new Array(len);

        for (let i = 0; i < len; i += 1) {
            for (col = 0; col < maxColumn; col += 1) {
                isForbidden[col] = false;
            }
            for (let j = 0; j < i; j += 1) {
                if (this.overlap(events[i], events[j])) {
                    isForbidden[events[j].position] = true;
                }
            }
            for (col = 0; col < maxColumn; col += 1) {
                if (!isForbidden[col]) {
                    break;
                }
            }
            if (col < maxColumn) {
                events[i].position = col;
            } else {
                events[i].position = maxColumn++;
            }
        }

        if (this.dir === 'rtl') {
            for (let i = 0; i < len; i += 1) {
                events[i].position = maxColumn - 1 - events[i].position;
            }
        }
    }

    private static calculateWidth(orderedEvents:IDisplayEvent[], size:number, hourParts:number) {
        let totalSize = size * hourParts,
            cells:{ calculated: boolean; events: IDisplayEvent[]; }[] = new Array(totalSize);

        // sort by position in descending order, the right most columns should be calculated first
        orderedEvents.sort((eventA, eventB) => {
            return eventB.position - eventA.position;
        });
        for (let i = 0; i < totalSize; i += 1) {
            cells[i] = {
                calculated: false,
                events: []
            };
        }
        let len = orderedEvents.length;
        for (let i = 0; i < len; i += 1) {
            let event = orderedEvents[i];
            let index = event.startIndex * hourParts + event.startOffset;
            while (index < event.endIndex * hourParts - event.endOffset) {
                cells[index].events.push(event);
                index += 1;
            }
        }

        let i = 0;
        while (i < len) {
            let event = orderedEvents[i];
            if (!event.overlapNumber) {
                let overlapNumber = event.position + 1;
                event.overlapNumber = overlapNumber;
                let eventQueue = [event];
                while ((event = eventQueue.shift())) {
                    let index = event.startIndex * hourParts + event.startOffset;
                    while (index < event.endIndex * hourParts - event.endOffset) {
                        if (!cells[index].calculated) {
                            cells[index].calculated = true;
                            if (cells[index].events) {
                                let eventCountInCell = cells[index].events.length;
                                for (let j = 0; j < eventCountInCell; j += 1) {
                                    let currentEventInCell = cells[index].events[j];
                                    if (!currentEventInCell.overlapNumber) {
                                        currentEventInCell.overlapNumber = overlapNumber;
                                        eventQueue.push(currentEventInCell);
                                    }
                                }
                            }
                        }
                        index += 1;
                    }
                }
            }
            i += 1;
        }
    }

    eventSelected(event:IEvent) {
        this.onEventSelected.emit(event);
    }

    setScrollPosition(scrollPosition:number) {
        this.initScrollPosition = scrollPosition;
    }
    
}
