import os


class PowerPointController:
    """Controls the currently running PowerPoint slideshow on Windows."""

    def __init__(self):
        self.enabled = os.name == "nt"
        self.error = ""

        if not self.enabled:
            self.error = "PowerPoint control is available on Windows only."
            return

        try:
            import pythoncom
            import win32com.client

            pythoncom.CoInitialize()
            self.win32com = win32com.client
        except Exception as error:
            self.enabled = False
            self.error = f"PowerPoint support is not installed: {error}"

    def _get_slideshow_view(self):
        if not self.enabled:
            return None, self.error

        try:
            application = self.win32com.GetActiveObject("PowerPoint.Application")

            if application.SlideShowWindows.Count == 0:
                return None, (
                    "Open a PowerPoint file and start Slide Show first "
                    "with F5."
                )

            return application.SlideShowWindows(1).View, ""
        except Exception as error:
            return None, (
                "PowerPoint was not found. Open PowerPoint, start Slide Show "
                "with F5, then show a gesture. "
                f"Details: {error}"
            )

    def execute(self, gesture):
        view, message = self._get_slideshow_view()

        if view is None:
            return message

        try:
            if gesture == "NEXT":
                view.Next()
                return "PowerPoint: next slide"

            if gesture == "PREVIOUS":
                view.Previous()
                return "PowerPoint: previous slide"

            if gesture == "HOME":
                view.GotoSlide(1)
                return "PowerPoint: first slide"

            if gesture == "PLAY":
                # PowerPoint slideshow states:
                # 1 = running, 2 = paused.
                view.State = 1
                return "PowerPoint: resumed"

            if gesture == "PAUSE":
                view.State = 2
                return "PowerPoint: paused"

            if gesture == "POINTER":
                return "PowerPoint: pointer gesture detected"

            if gesture == "SELECT":
                return "PowerPoint: select gesture detected"

            return ""
        except Exception as error:
            return f"PowerPoint action failed: {error}"