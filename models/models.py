from django.db import models

class Review(models.Model):
    name = models.CharField(max_length=100)
    comment = models.TextField()
    rating = models.IntegerField()
    media = models.FileField(upload_to='reviews/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name