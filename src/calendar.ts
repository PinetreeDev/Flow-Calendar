import { Component, EventEmitter, Input, OnInit, Output, TemplateRef, Inject, LOCALE_ID } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

import { CalendarService } from './calendar.service';

export interface IEvent {
    allDay: boolean;
    endTime: Date;
    startTime: Date;
    title: string;
}

export interface IRange {
    startTime: Date;
    endTime: Date;
}

export interface IView {
}

export interface IDayView extends IView {
    allDayEvents: IDisplayAllDayEvent[];
    rows: IDayViewRow[];
}

export interface IDayViewRow {
    events: IDisplayEvent[];
    time: Date;
}

export interface IMonthView extends IView {
    dates: IMonthViewRow[];
    dayHeaders: string[];
}

export interface IMonthViewRow {
    current?: boolean;
    date: Date;
    events: IEvent[];
    hasEvent?: boolean;
    label: string;
    secondary: boolean;
    selected?: boolean;
    disabled: boolean;
}

export interface IWeekView extends IView {
    dates: IWeekViewDateRow[];
    rows: IWeekViewRow[][];
    dayHeaders: string[];
}

export interface IWeekViewDateRow {
    date: Date;
    events: IDisplayEvent[];
}

export interface IWeekViewRow {
    events: IDisplayEvent[];
    time: Date;
}

export interface IDisplayEvent {
    endIndex: number;
    endOffset?: number;
    event: IEvent;
    startIndex: number;
    startOffset?: number;
    overlapNumber?: number;
    position?: number;
}

export interface IDisplayAllDayEvent {
    event: IEvent;
}

export interface ICalendarComponent {
    currentViewIndex: number;
    direction: number;
    eventSource: IEvent[];
    getRange: { (date:Date): IRange; };
    getViewData: { (date:Date): IView };
    mode: CalendarMode;
    range: IRange;
    views: IView[];
    onDataLoaded: { (): void };
    onRangeChanged: EventEmitter<IRange>;
}

export interface ITimeSelected {
    events: IEvent[];
    selectedTime: Date;
    disabled: boolean;
}

export interface IMonthViewDisplayEventTemplateContext {
    view: IView,
    row: number,
    col: number
}

export interface IMonthViewEventDetailTemplateContext {
    selectedDate: ITimeSelected,
    noEventsLabel: string
}

export interface IDateFormatter {
    formatMonthViewDay?: { (date:Date): string; };
    formatMonthViewDayHeader?: { (date:Date): string; };
    formatMonthViewTitle?: { (date:Date): string; };
    formatWeekViewDayHeader?: { (date:Date): string; };
    formatWeekViewTitle?: { (date:Date): string; };
    formatWeekViewHourColumn?: { (date:Date): string; };
    formatDayViewTitle?: { (date:Date): string; };
    formatDayViewHourColumn?: { (date:Date): string; };
}

export type CalendarMode = 'day' | 'month' | 'week';

export type QueryMode = 'local' | 'remote';

export enum Step {
    QuarterHour = 15,
    HalfHour = 30,
    Hour = 60
}

@Component({
    selector: 'calendar',
    template: './calendar.html',
    styles: ['./calendar.css'],
    providers: [CalendarService]
})
export class CalendarComponent implements OnInit {
    
    @Input()
    get currentDate():Date {
        return this._currentDate;
    }

    set currentDate(val:Date) {
        if (!val) {
            val = new Date();
        }

        this._currentDate = val;
        this.calendarService.setCurrentDate(val, true);
        this.onCurrentDateChanged.emit(this._currentDate);
    }

    @Input() eventSource:IEvent[] = [];
    @Input() calendarMode:CalendarMode = 'month';
    @Input() formatDay:string = 'd';
    @Input() formatDayHeader:string = 'EEE';
    @Input() formatDayTitle:string = 'MMMM dd, yyyy';
    @Input() formatWeekTitle:string = 'MMMM yyyy, Week $n';
    @Input() formatMonthTitle:string = 'MMMM yyyy';
    @Input() formatWeekViewDayHeader:string = 'EEE d';
    @Input() formatHourColumn:string = 'j';
    @Input() showEventDetail:boolean = true;
    @Input() startingDayMonth:number = 0;
    @Input() startingDayWeek:number = 0;
    @Input() allDayLabel:string = 'all day';
    @Input() noEventsLabel:string = 'No Events';
    @Input() queryMode:QueryMode = 'local';
    @Input() step:Step = Step.Hour;
    @Input() autoSelect:boolean = true;
    @Input() markDisabled:(date:Date) => boolean;
    @Input() monthviewDisplayEventTemplate:TemplateRef<IMonthViewDisplayEventTemplateContext>;
    @Input() monthviewInactiveDisplayEventTemplate:TemplateRef<IMonthViewDisplayEventTemplateContext>;
    @Input() monthviewEventDetailTemplate:TemplateRef<IMonthViewEventDetailTemplateContext>;
    @Input() weekviewAllDayEventTemplate:TemplateRef<IDisplayAllDayEvent>;
    @Input() weekviewNormalEventTemplate:TemplateRef<IDisplayEvent>;
    @Input() dayviewAllDayEventTemplate:TemplateRef<IDisplayAllDayEvent>;
    @Input() dayviewNormalEventTemplate:TemplateRef<IDisplayEvent>;
    @Input() dateFormatter:IDateFormatter;
    @Input() dir:string = "";
    @Input() scrollToHour:number = 0;
    @Input() preserveScrollPosition:boolean = false;
    @Input() lockSwipeToPrev:boolean = false;
    @Input() lockSwipes:boolean = false;
    @Input() locale:string = "";
    @Input() startHour:number = 0;
    @Input() endHour:number = 24;
    @Input() spaceBetween:number = 0;

    @Output() onCurrentDateChanged = new EventEmitter<Date>();
    @Output() onRangeChanged = new EventEmitter<IRange>();
    @Output() onEventSelected = new EventEmitter<IEvent>();
    @Output() onTimeSelected = new EventEmitter<ITimeSelected>();
    @Output() onTitleChanged = new EventEmitter<string>();

    private _currentDate:Date;
    private hourParts = 1;
    private currentDateChangedFromChildrenSubscription:Subscription;

    constructor(private calendarService:CalendarService, @Inject(LOCALE_ID) private appLocale:string) {
        this.locale = appLocale;
    }

    ngOnInit() {
        if (this.autoSelect) {
            if (this.autoSelect.toString() === 'false') {
                this.autoSelect = false;
            } else {
                this.autoSelect = true;
            }
        }
        this.hourParts = 60 / this.step;
        this.startHour = parseInt(this.startHour.toString());
        this.endHour = parseInt(this.endHour.toString());
        this.calendarService.queryMode = this.queryMode;

        this.currentDateChangedFromChildrenSubscription = this.calendarService.currentDateChangedFromChildren$.subscribe(currentDate => {
            this._currentDate = currentDate;
            this.onCurrentDateChanged.emit(currentDate);
        });
    }

    ngOnDestroy() {
        if (this.currentDateChangedFromChildrenSubscription) {
            this.currentDateChangedFromChildrenSubscription.unsubscribe();
            this.currentDateChangedFromChildrenSubscription = null;
        }
    }

    rangeChanged(range:IRange) {
        this.onRangeChanged.emit(range);
    }

    eventSelected(event:IEvent) {
        this.onEventSelected.emit(event);
    }

    timeSelected(timeSelected:ITimeSelected) {
        this.onTimeSelected.emit(timeSelected);
    }

    titleChanged(title:string) {
        this.onTitleChanged.emit(title);
    }

    loadEvents() {
        this.calendarService.loadEvents();
    }

}
